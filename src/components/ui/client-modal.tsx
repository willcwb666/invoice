"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  MapPin,
  Phone,
  Mail,
  Check,
  AlertCircle,
  Loader2,
  Bed,
  Bath,
  Maximize2,
  Home,
  Sparkles,
  Key,
  Shield,
  Dog,
  Car,
} from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { AddressNormalizer } from "@/lib/address-normalizer";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdClient: any) => void;
  zIndex?: string;
  initialQuery?: string;
}

interface MapboxSuggestion {
  mapbox_id: string;
  name: string;
  place_formatted?: string;
  full_address?: string;
}

export function ClientModal({
  isOpen,
  onClose,
  onSuccess,
  zIndex = "z-50",
  initialQuery = "",
}: ClientModalProps) {
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Greeley",
    state: "CO",
    zipCode: "80634",
    bedrooms: "" as number | "",
    bathrooms: "" as number | "",
    squareFeet: "" as number | "",
    propertyType: "",
    billingType: "PER_JOB" as "PER_JOB" | "CONSOLIDATED_MONTHLY",
    entryCode: "",
    alarmCode: "",
    pets: "",
    parkingInstructions: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingProperty, setIsFetchingProperty] = useState(false);
  const [propertySource, setPropertySource] = useState<string | null>(null);

  // Mapbox suggestions state
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingMapbox, setIsSearchingMapbox] = useState(false);
  const mapboxSessionTokenRef = useRef<string>("");
  const lastQueriedAddressRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize or reset session token on open
  useEffect(() => {
    if (isOpen) {
      mapboxSessionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
      if (initialQuery && initialQuery.trim()) {
        const query = initialQuery.trim();
        const isLikelyAddress =
          /^\d+/.test(query) ||
          /\b(st|street|ave|avenue|dr|drive|rd|road|blvd|lane|ct|court|way|pl)\b/i.test(query);
        setFormData({
          name: isLikelyAddress ? "" : query,
          email: "",
          phone: "",
          address: isLikelyAddress ? query : "",
          city: "Greeley",
          state: "CO",
          zipCode: "80634",
          bedrooms: "",
          bathrooms: "",
          squareFeet: "",
          propertyType: "",
          billingType: "PER_JOB",
          entryCode: "",
          alarmCode: "",
          pets: "",
          parkingInstructions: "",
          notes: "",
        });

        if (isLikelyAddress) {
          lookupProperty(query);
        }
      } else {
        resetForm();
      }
      setError(null);
    }
  }, [isOpen, initialQuery]);

  // Click outside suggestions listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsContainerRef.current &&
        !suggestionsContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "Greeley",
      state: "CO",
      zipCode: "80634",
      bedrooms: "",
      bathrooms: "",
      squareFeet: "",
      propertyType: "",
      billingType: "PER_JOB",
      entryCode: "",
      alarmCode: "",
      pets: "",
      parkingInstructions: "",
      notes: "",
    });
    setError(null);
    setSuggestions([]);
    setShowSuggestions(false);
    lastQueriedAddressRef.current = "";
    setPropertySource(null);
  };

  /**
   * Queries RentCast Property API via our internal API route
   */
  const lookupProperty = useCallback(
    async (rawAddress: string, explicitCity?: string, explicitState?: string, explicitZip?: string) => {
      const addressToQuery = rawAddress.trim();
      if (!addressToQuery || addressToQuery.length < 5) return;

      const normalizedQuery = addressToQuery.toLowerCase().replace(/\s+/g, " ");
      if (normalizedQuery === lastQueriedAddressRef.current) return;
      lastQueriedAddressRef.current = normalizedQuery;

      setIsFetchingProperty(true);
      showToast("Consultando dados do imóvel na RentCast...", "info", 4000);

      try {
        const norm = AddressNormalizer.normalize(
          addressToQuery,
          explicitCity || formData.city,
          explicitState || formData.state,
          explicitZip || formData.zipCode
        );

        const res = await fetch(
          `/api/v1/properties/lookup?address=${encodeURIComponent(norm.fullAddress)}`
        );

        if (!res.ok) {
          setIsFetchingProperty(false);
          return;
        }

        const json = await res.json();
        if (json.error) {
          showToast(json.error, "warning", 5000);
          return;
        }
        if (json.success && json.found && json.data) {
          const prop = json.data;
          setFormData((prev) => ({
            ...prev,
            bedrooms: prop.bedrooms !== null ? prop.bedrooms : prev.bedrooms,
            bathrooms: prop.bathrooms !== null ? prop.bathrooms : prev.bathrooms,
            squareFeet: prop.squareFeet !== null ? prop.squareFeet : prev.squareFeet,
            propertyType: prop.propertyType || prev.propertyType,
          }));
          setPropertySource("RentCast");

          const details: string[] = [];
          if (prop.bedrooms !== null) details.push(`${prop.bedrooms} quartos`);
          if (prop.bathrooms !== null) details.push(`${prop.bathrooms} banheiros`);
          if (prop.squareFeet !== null) details.push(`${prop.squareFeet.toLocaleString()} sqft`);

          const msg = details.length > 0 ? details.join(", ") : "dados atualizados";
          showToast(`✓ Imóvel encontrado: ${msg}`, "success", 5000);
        }
      } catch (err) {
        console.error("Falha ao buscar propriedade no RentCast:", err);
      } finally {
        setIsFetchingProperty(false);
      }
    },
    [showToast, formData.city, formData.state, formData.zipCode]
  );

  /**
   * Trigger RentCast on address input blur
   */
  const handleAddressBlur = () => {
    // Delay slightly to allow suggestion click to fire first if user clicked a suggestion
    setTimeout(() => {
      if (formData.address && formData.address.trim().length >= 6) {
        const norm = AddressNormalizer.normalize(
          formData.address,
          formData.city,
          formData.state,
          formData.zipCode
        );
        if (norm.street && norm.street !== formData.address) {
          setFormData((prev) => ({
            ...prev,
            address: norm.street,
            city: norm.city || prev.city,
            state: norm.state || prev.state,
            zipCode: norm.zipCode || prev.zipCode,
          }));
        }
        lookupProperty(norm.fullAddress, norm.city, norm.state, norm.zipCode || undefined);
      }
    }, 200);
  };

  /**
   * Mapbox Address Autocomplete query with debouncing
   */
  const handleAddressChange = (value: string) => {
    setFormData((prev) => ({ ...prev, address: value }));

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken || value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setIsSearchingMapbox(true);
        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(
          value.trim()
        )}&access_token=${mapboxToken}&session_token=${
          mapboxSessionTokenRef.current
        }&country=us&types=address`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }
      } catch (err) {
        console.error("Erro no Mapbox suggest:", err);
      } finally {
        setIsSearchingMapbox(false);
      }
    }, 300);
  };

  /**
   * User clicks a Mapbox address suggestion
   */
  const handleSelectSuggestion = async (suggestion: MapboxSuggestion) => {
    setShowSuggestions(false);
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    let street = suggestion.name;
    let city = formData.city;
    let state = formData.state;
    let zipCode = formData.zipCode;

    if (mapboxToken && suggestion.mapbox_id) {
      try {
        const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?access_token=${mapboxToken}&session_token=${mapboxSessionTokenRef.current}`;
        const res = await fetch(retrieveUrl);
        if (res.ok) {
          const data = await res.json();
          const feature = data.features?.[0];
          if (feature) {
            const props = feature.properties;
            street = props.name || props.address || street;
            const ctx = props.context || {};
            if (ctx.place?.name) city = ctx.place.name;
            if (ctx.locality?.name && !ctx.place?.name) city = ctx.locality.name;
            if (ctx.region?.region_code) state = ctx.region.region_code;
            if (ctx.postcode?.name) zipCode = ctx.postcode.name;
          }
        }
      } catch (err) {
        console.error("Erro ao recuperar detalhes do Mapbox:", err);
      }
    } else if (suggestion.place_formatted) {
      // Fallback parsing from place_formatted: e.g. "Centennial, Colorado 80121, United States"
      const parts = suggestion.place_formatted.split(",").map((p) => p.trim());
      if (parts.length >= 1) city = parts[0];
      if (parts.length >= 2) {
        const stateZipMatch = parts[1].match(/([A-Za-z\s]+)\s+(\d{5})/);
        if (stateZipMatch) {
          zipCode = stateZipMatch[2];
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      address: street,
      city,
      state,
      zipCode,
    }));

    // Trigger RentCast lookup immediately with complete address
    lookupProperty(`${street}, ${city}, ${state} ${zipCode}`, city, state, zipCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const fullAddress = formData.address.trim();
      if (!fullAddress) {
        throw new Error("Endereço é obrigatório para rota GPS e faturamento.");
      }

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: fullAddress,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || "CO",
        zipCode: formData.zipCode.trim() || undefined,
        bedrooms: formData.bedrooms === "" ? undefined : Number(formData.bedrooms),
        bathrooms: formData.bathrooms === "" ? undefined : Number(formData.bathrooms),
        squareFeet: formData.squareFeet === "" ? undefined : Number(formData.squareFeet),
        propertyType: formData.propertyType.trim() || undefined,
        billingType: formData.billingType,
        notes: formData.notes.trim() || undefined,
      };

      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details) {
          const firstErr = Object.values(json.details)[0];
          throw new Error(
            Array.isArray(firstErr) ? firstErr[0] : json.error || "Erro ao salvar cliente."
          );
        }
        throw new Error(json.error || "Erro ao salvar cliente.");
      }

      resetForm();
      if (onSuccess) {
        onSuccess(json.data);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao cadastrar cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      icon={<UserPlus className="w-5 h-5" />}
      title="Novo Cliente"
      subtitle="Cadastre dados completos para faturas, rota GPS e agenda"
      backdropClassName={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto`}
      closeButtonClassName="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    >
      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Nome Completo / Família *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Sarah Johnson ou Dr. Henderson Office"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Telefone (WhatsApp / SMS)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ex: (970) 555-0192"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                E-mail para Faturas
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Address & GPS */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Endereço para Navegação GPS (Apple & Google Maps)</span>
            </div>
            {isFetchingProperty && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>RentCast...</span>
              </span>
            )}
          </div>

          {/* Logradouro with Mapbox suggestions dropdown */}
          <div className="relative" ref={suggestionsContainerRef}>
            <label className="block text-slate-700 font-semibold mb-1">
              Logradouro & Número *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Ex: 2410 17th Ave ou 4172 MeadowView Way"
                value={formData.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onBlur={handleAddressBlur}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
              />
              {isSearchingMapbox && (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100"
                >
                  {suggestions.map((s) => (
                    <button
                      type="button"
                      key={s.mapbox_id}
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/70 transition-colors flex items-start gap-2 text-xs cursor-pointer group"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        {s.place_formatted && (
                          <div className="text-[11px] text-slate-500 leading-tight">
                            {s.place_formatted}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-slate-700 font-semibold mb-1">Cidade</label>
              <input
                type="text"
                placeholder="Greeley"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Estado</label>
              <input
                type="text"
                placeholder="CO"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 uppercase font-mono focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Zip Code</label>
              <input
                type="text"
                placeholder="80634"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
              />
            </div>
          </div>
        </div>

        {/* Property Dimensions (RentCast / Manual) */}
        <div className="pt-2 border-t border-slate-100 space-y-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
              <Home className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dimensões do Imóvel</span>
            </div>
            {propertySource ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Sparkles className="w-2.5 h-2.5" />
                Preenchido via {propertySource}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Preenchimento automático ou manual</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Bed className="w-3 h-3 text-slate-500" />
                <span>Quartos</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ex: 3"
                value={formData.bedrooms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bedrooms: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Bath className="w-3 h-3 text-slate-500" />
                <span>Banheiros</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="Ex: 2.5"
                value={formData.bathrooms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bathrooms: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Maximize2 className="w-3 h-3 text-slate-500" />
                <span>Área (sqft)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ex: 2400"
                value={formData.squareFeet}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    squareFeet: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono"
              />
            </div>
          </div>

          {formData.propertyType && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
              <span className="font-semibold text-slate-600">Tipo:</span>
              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 font-medium">
                {formData.propertyType}
              </span>
            </div>
          )}
        </div>

        {/* Billing Type */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <label className="block text-slate-700 font-semibold mb-1">
            Tipo de Faturamento & Cobrança *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, billingType: "PER_JOB" })}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                formData.billingType === "PER_JOB"
                  ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/30"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  formData.billingType === "PER_JOB"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {formData.billingType === "PER_JOB" && <Check className="w-2.5 h-2.5" />}
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-xs">Por Trabalho / Faxina</span>
                <span className="text-[11px] text-slate-500">
                  Fatura emitida a cada limpeza avulsa
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, billingType: "CONSOLIDATED_MONTHLY" })}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                formData.billingType === "CONSOLIDATED_MONTHLY"
                  ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/30"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  formData.billingType === "CONSOLIDATED_MONTHLY"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {formData.billingType === "CONSOLIDATED_MONTHLY" && <Check className="w-2.5 h-2.5" />}
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-xs">Consolidado Mensal</span>
                <span className="text-[11px] text-slate-500">
                  Agrupa todas as limpezas do mês em 1 fatura
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Access Intelligence (Codes, Alarm, Pets, Parking) */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-600" />
            <span>Instruções de Acesso & Segurança (Diarista / GPS)</span>
          </label>
          <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
                <Key className="w-3 h-3 text-slate-400" /> Portão / Porta / Lockbox:
              </label>
              <input
                type="text"
                placeholder="Ex: Lockbox #4590, Chave sob o vaso"
                value={formData.entryCode}
                onChange={(e) => setFormData({ ...formData, entryCode: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" /> Alarme / Desarme:
              </label>
              <input
                type="text"
                placeholder="Ex: Código 1234 (espera 30s)"
                value={formData.alarmCode}
                onChange={(e) => setFormData({ ...formData, alarmCode: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
                <Dog className="w-3 h-3 text-slate-400" /> Animais / Pets:
              </label>
              <input
                type="text"
                placeholder="Ex: 2 cães dóceis, deixar na lavanderia"
                value={formData.pets}
                onChange={(e) => setFormData({ ...formData, pets: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
                <Car className="w-3 h-3 text-slate-400" /> Onde Estacionar:
              </label>
              <input
                type="text"
                placeholder="Ex: Garagem ou lado esquerdo da rua"
                value={formData.parkingInstructions}
                onChange={(e) => setFormData({ ...formData, parkingInstructions: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-slate-700 font-semibold mb-1">
            Observações de Acesso & Detalhes
          </label>
          <textarea
            rows={2}
            placeholder="Ex: Código da porta da garagem: 4821. Cão dócil no quintal. Limpar bem o vidro da sacada."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
          />
        </div>

        {/* Modal Actions */}
        <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando Cliente...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Cadastrar Cliente</span>
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
