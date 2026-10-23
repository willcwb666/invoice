"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Camera, Image as ImageIcon, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface AppointmentPhoto {
  id: string;
  photoType: "BEFORE" | "AFTER";
  photoUrl: string;
  room: string | null;
  caption: string | null;
  createdAt: string;
}

interface PhotoModalProps {
  appointmentId: string;
  clientName: string;
  onClose: () => void;
}

export function PhotoModal({ appointmentId, clientName, onClose }: PhotoModalProps) {
  const [photos, setPhotos] = useState<AppointmentPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "BEFORE" | "AFTER">("ALL");
  const [photoType, setPhotoType] = useState<"BEFORE" | "AFTER">("BEFORE");
  const [room, setRoom] = useState("Cozinha");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPhotos() {
      try {
        const res = await fetch(`/api/v1/appointments/${appointmentId}/photos`);
        if (res.ok) {
          const json = await res.json();
          setPhotos(json.data || []);
        }
      } catch (err) {
        console.error("Erro ao carregar fotos:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPhotos();
  }, [appointmentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) return;

    setUploading(true);
    try {
      const res = await fetch(`/api/v1/appointments/${appointmentId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoType,
          photoUrl: previewUrl,
          room,
          caption: caption.trim() || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setPhotos((prev) => [json.data, ...prev]);
        setPreviewUrl(null);
        setCaption("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Erro ao salvar foto:", err);
    } finally {
      setUploading(false);
    }
  };

  const filtered =
    activeTab === "ALL" ? photos : photos.filter((p) => p.photoType === activeTab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-base">Fotos Antes & Depois</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{clientName} • Registro de Blindagem</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Todas ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("BEFORE")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "BEFORE"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Antes ({photos.filter((p) => p.photoType === "BEFORE").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("AFTER")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "AFTER"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Depois ({photos.filter((p) => p.photoType === "AFTER").length})
          </button>
        </div>

        {/* Gallery / Photos Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Carregando fotos...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <ImageIcon className="w-8 h-8 text-slate-300" />
              <span>Nenhuma foto registrada ainda.</span>
              <span className="text-[11px] text-slate-400">Tire fotos antes de começar e ao finalizar para blindar o serviço.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((photo) => (
                <div
                  key={photo.id}
                  className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col shadow-xs"
                >
                  <div className="relative aspect-4/3 bg-slate-900 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.photoUrl}
                      alt={photo.caption || "Foto do atendimento"}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        photo.photoType === "BEFORE"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-emerald-500 text-white shadow-xs"
                      }`}
                    >
                      {photo.photoType === "BEFORE" ? "Antes" : "Depois"}
                    </span>
                    {photo.room && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                        {photo.room}
                      </span>
                    )}
                  </div>
                  {photo.caption && (
                    <div className="p-2 text-[11px] text-slate-700 font-medium">
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Drawer / Capture Form */}
        <form onSubmit={handleSavePhoto} className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Tirar ou Selecionar Foto</span>
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPhotoType("BEFORE")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        photoType === "BEFORE"
                          ? "bg-amber-600 text-white"
                          : "bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      Antes
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoType("AFTER")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        photoType === "AFTER"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      Depois
                    </button>
                  </div>

                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700"
                  >
                    <option value="Cozinha">Cozinha</option>
                    <option value="Banheiro Principal">Banheiro Principal</option>
                    <option value="Banheiro Social">Banheiro Social</option>
                    <option value="Quarto Casal">Quarto Casal</option>
                    <option value="Sala de Estar">Sala de Estar</option>
                    <option value="Outro">Outro Cômodo</option>
                  </select>
                </div>
              </div>

              <input
                type="text"
                placeholder="Observação da foto (ex: Mancha preexistente no piso)..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-indigo-500"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Foto</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
