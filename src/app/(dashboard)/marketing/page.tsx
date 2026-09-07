"use client";

import React, { useState } from "react";
import { Header } from "@/components/dashboard/header";
import { Sparkles, Copy, Check, Download, Phone, CheckCircle2 } from "lucide-react";

export default function MarketingPage() {
  const [platform, setPlatform] = useState<"nextdoor" | "facebook">("nextdoor");
  const [serviceType, setServiceType] = useState("Move-out & Deep Cleaning");
  const [city, setCity] = useState("Greeley / Evans / Loveland, CO");
  const [copied, setCopied] = useState(false);

  // Template inteligente pré-formatado no tom cultural do Nextdoor e Facebook local
  const getCopy = () => {
    if (platform === "nextdoor") {
      return `Hi neighbors! 👋\n\nAre you moving out or need a deep/standard cleaning for your home or office in ${city}?\n\nMy name is Renata, and I run a local family cleaning service based in Evans. We are thorough, reliable, and have great local references! ✨\n\n✅ Standard Cleaning\n✅ Deep Cleaning & Move-Outs\n✅ Office / Commercial Cleaning\n✅ Flexible scheduling & Free Estimates!\n\n📱 Call or text me at (970) 412-9406 for a quick quote. Happy to help!`;
    }
    return `✨ Sparkle & Shine with Renata's Cleaning Services! ✨\n\nServing ${city} with top-notch residential and commercial cleaning:\n\n🏡 House Standard & Deep Cleaning\n📦 Move-Out / Move-In Cleaning\n💼 Commercial Offices\n\nReliable, experienced, and affordable. We bring our own supplies!\n\n📞 Text or Call (970) 412-9406 to book your spot! Free Estimates.`;
  };

  const currentCopy = getCopy();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Header
        title="Marketing & Divulgação com IA"
        subtitle="Gerador de copy persuasivo e banners locais para Nextdoor e Facebook"
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Controles de Geração */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-sm">Gerador de Anúncios Locais</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Plataforma de Divulgação</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                <option value="nextdoor">Nextdoor (Tom de Vizinho Confiável)</option>
                <option value="facebook">Facebook Groups (Comercial / Flyer)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Foco do Serviço</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                <option value="Move-out & Deep Cleaning">Move-out & Deep Cleaning</option>
                <option value="Office & Commercial">Escritórios Comerciais</option>
                <option value="Residential Standard">Limpeza Residencial Regular</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Cidades Atendidas</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Pré-visualização da Copy e do Banner Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Caixa de Texto Copiável */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Texto do Post ({platform === "nextdoor" ? "Nextdoor" : "Facebook"})
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
                </button>
              </div>

              <textarea
                readOnly
                value={currentCopy}
                rows={12}
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono leading-relaxed resize-none focus:outline-none"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              💡 <strong>Dica:</strong> No Nextdoor, sempre poste esse texto acompanhado de uma foto real de antes/depois tirada no seu celular. Converte 4x mais do que artes sintéticas.
            </p>
          </div>

          {/* Banner Gráfico Pronto para Download */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Flyer Digital Diagramado
              </span>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Arte</span>
              </button>
            </div>

            {/* Flyer Card */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-center space-y-4 shadow-xl relative overflow-hidden">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold uppercase tracking-wider">
                Professional Cleaning Services
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">
                Renata Matos de Oliveira
              </h2>

              <p className="text-xs text-slate-200 max-w-xs mx-auto">
                Quality residential and commercial cleaning in Evans, Greeley & Loveland.
              </p>

              <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Move-Out & Deep Cleaning</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Commercial & Office Spaces</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Free Estimates & Flexible Hours</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-slate-300 block mb-1">Call or Text for a Quote:</span>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-indigo-900 font-bold text-sm font-mono shadow-lg">
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <span>(970) 412-9406</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
