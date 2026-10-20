"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Receipt,
  Search,
  User,
  UserPlus,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Home,
  Layers,
  Repeat,
  Maximize2,
  Plus,
  Minus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Copy,
  Info,
  Sliders,
  PackageCheck,
  Wand2,
  Trash2,
} from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { calculateEstimateDuration } from "@/lib/scheduling/duration";

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdEstimate: any) => void;
}

interface ServiceCatalogItem {
  id: string;
  name: string;
  description?: string | null;
  type: "STANDARD" | "EXTRA";
  basePrice: number | string;
  availableInEstimates?: boolean;
}

const CLEANING_TYPES = [
  {
    id: "STANDARD",
    name: "Standard Cleaning",
    subtitle: "Manutenção & Limpeza Padrão",
    desc: "Varrer, passar pano, espanar, desinfecção de banheiros, cozinha e áreas comuns.",
    icon: Home,
    defaultPrice: 180,
    badge: "Mais Frequente",
  },
  {
    id: "DEEP",
    name: "Deep Cleaning",
    subtitle: "Limpeza Pesada & Detalhada",
    desc: "Desinfecção profunda, rodapés, azulejos de cima a baixo, detalhes e cantos difíceis.",
    icon: Sparkles,
    defaultPrice: 220,
    badge: "Recomendado Inicial",
  },
  {
    id: "MOVE",
    name: "Move-In / Move-Out",
    subtitle: "Mudança / Desocupação",
    desc: "Preparação completa para entrega ou entrada de imóvel, cômodos vazios e armários.",
    icon: PackageCheck,
    defaultPrice: 300,
    badge: "Imóveis Vazios",
  },
];

const FREQUENCIES = [
  {
    id: "ONE_TIME",
    name: "One-Time",
    subtitle: "Atendimento Avulso",
    discountPercent: 0,
    discountLabel: "Sem desconto",
  },
  {
    id: "MONTHLY",
    name: "Monthly",
    subtitle: "1x por mês",
    discountPercent: 5,
    discountLabel: "5% OFF",
  },
  {
    id: "BI_WEEKLY",
    name: "Every Other Week",
    subtitle: "A cada 15 dias (Quinzenal)",
    discountPercent: 15,
    discountLabel: "15% OFF",
    highlight: true,
    badge: "Mais Popular ⭐",
  },
  {
    id: "WEEKLY",
    name: "Weekly",
    subtitle: "Semanal",
    discountPercent: 20,
    discountLabel: "20% OFF",
    badge: "Maior Economia 🔥",
  },
];

const DEFAULT_EXTRAS_CONFIG = [
  { id: "Detail Window Blinds", name: "Detail Window Blinds", icon: "🪟", defaultPrice: 30 },
  { id: "Inside Oven", name: "Inside Oven", icon: "🍳", defaultPrice: 35 },
  { id: "Inside Fridge", name: "Inside Fridge", icon: "🧊", defaultPrice: 35 },
  { id: "Inside Cabinets", name: "Inside Cabinets", icon: "🚪", defaultPrice: 40 },
  { id: "Heavy Duty", name: "Heavy Duty", icon: "⚠️", defaultPrice: 60 },
  { id: "Dishes", name: "Dishes", icon: "🍽️", defaultPrice: 25 },
  { id: "Laundry", name: "Laundry", icon: "🧺", defaultPrice: 30 },
  { id: "Carpet Cleaning", name: "Carpet Cleaning", icon: "🧹", defaultPrice: 80 },
];

export interface CustomServiceItem {
  id: string;
  name: string;
  price: number;
}

export function EstimateModal({ isOpen, onClose, onSuccess }: EstimateModalProps) {
  // Stepper State (1 to 7)
  const [currentStep, setCurrentStep] = useState(1);

  // Clients & Catalog
  const [clients, setClients] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceCatalogItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Step 1: Client Selection or Creation
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });

  // Step 2: Cleaning Type (Starts unselected)
  const [cleaningType, setCleaningType] = useState<"STANDARD" | "DEEP" | "MOVE" | "">("");

  // Step 3: Frequency (Starts at ONE_TIME = 0% discount so Step 2 shows exact base price)
  const [frequency, setFrequency] = useState("ONE_TIME");

  // Step 4: Dimensions & Scope (Starts completely zeroed out)
  const [bedrooms, setBedrooms] = useState(0);
  const [fullBaths, setFullBaths] = useState(0);
  const [halfBaths, setHalfBaths] = useState(0);
  const [sqFt, setSqFt] = useState(0);
  const [isPartialScope, setIsPartialScope] = useState(false);
  const [partialRooms, setPartialRooms] = useState({
    bedrooms: 0,
    fullBaths: 0,
    halfBaths: 0,
    livingRoom: false,
    kitchen: false,
  });

  // Step 5: Extras & Custom Unusual Requests
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [customServices, setCustomServices] = useState<CustomServiceItem[]>([]);

  // Step 6: Condition Ratings (Starts disabled/unselected)
  const [conditionRatings, setConditionRatings] = useState<{
    bathrooms: number | null;
    roomsKitchen: number | null;
    pets: number | null;
    kids: number | null;
  }>({
    bathrooms: null,
    roomsKitchen: null,
    pets: null,
    kids: null,
  });

  // Step 7: Final & Meta
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [estimateNumber, setEstimateNumber] = useState("");
  const [notes, setNotes] = useState(
    "Orçamento personalizado com garantia de satisfação. Inclui todos os produtos profissionais e equipamentos necessários. Sem taxas ocultas."
  );
  const [aiProposalCopied, setAiProposalCopied] = useState(false);

  // Submission
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [silentDraftId, setSilentDraftId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setError(null);
      setCleaningType("");
      setFrequency("ONE_TIME");
      setSelectedClient(null);
      setSilentDraftId(null);
      setBedrooms(0);
      setFullBaths(0);
      setHalfBaths(0);
      setSqFt(0);
      setIsPartialScope(false);
      setPartialRooms({
        bedrooms: 0,
        fullBaths: 0,
        halfBaths: 0,
        livingRoom: false,
        kitchen: false,
      });
      setSelectedExtras([]);
      setCustomPrompt("");
      setCustomServices([]);
      setConditionRatings({
        bathrooms: null,
        roomsKitchen: null,
        pets: null,
        kids: null,
      });
      setEstimateNumber(`EST-${Date.now().toString().slice(-4)}`);
      loadClientsAndServices();
    }
  }, [isOpen]);

  // AI Parser handler for custom / unusual services
  const handleParseCustomServicesWithAI = async () => {
    if (!customPrompt.trim()) return;
    setIsParsingAI(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/estimates/parse-custom-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customPrompt.trim(), defaultPrice: 20 }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data) && json.data.length > 0) {
        setCustomServices((prev) => [...prev, ...json.data]);
        setCustomPrompt("");
      } else {
        setError(json.error || "Nenhum serviço identificado no texto informado.");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao interpretar pedidos.");
    } finally {
      setIsParsingAI(false);
    }
  };

  const updateCustomServicePrice = (id: string, newPrice: number) => {
    setCustomServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: Math.max(0, newPrice) } : s))
    );
  };

  const removeCustomService = (id: string) => {
    setCustomServices((prev) => prev.filter((s) => s.id !== id));
  };

  const loadClientsAndServices = async () => {
    setLoadingData(true);
    try {
      const [resClients, resServices] = await Promise.all([
        fetch("/api/v1/clients"),
        fetch("/api/v1/services"),
      ]);
      if (resClients.ok) {
        const jc = await resClients.json();
        setClients(jc.data || []);
      }
      if (resServices.ok) {
        const js = await resServices.json();
        setCatalogServices(js.data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do orçamento:", e);
    } finally {
      setLoadingData(false);
    }
  };

  // Busca consistente do preço base por ID do Tipo de Limpeza (usado no card do Passo 2 e no cálculo)
  const getCleaningTypePrice = (typeId: string): number => {
    const activeServices = catalogServices.filter((s) => s.availableInEstimates !== false);

    if (typeId === "STANDARD") {
      const found =
        activeServices.find((s) => s.name.trim().toLowerCase() === "standard cleaning") ||
        activeServices.find((s) => s.name.trim().toLowerCase() === "house - standard cleaning");
      return found && Number(found.basePrice) > 0 ? Number(found.basePrice) : 180;
    }

    if (typeId === "DEEP") {
      const found = activeServices.find(
        (s) => s.name.trim().toLowerCase() === "deep cleaning"
      );
      return found && Number(found.basePrice) > 0 ? Number(found.basePrice) : 220;
    }

    if (typeId === "MOVE") {
      const found =
        activeServices.find((s) => s.name.trim().toLowerCase() === "move-in / move-out") ||
        activeServices.find((s) => s.name.trim().toLowerCase() === "moving out/in");
      return found && Number(found.basePrice) > 0 ? Number(found.basePrice) : 300;
    }

    return 0;
  };

  // Busca exata de preço de Serviço Extra no catálogo ou fallback
  const getServicePrice = (name: string, fallback: number): number => {
    const target = name.trim().toLowerCase();
    const activeServices = catalogServices.filter((s) => s.availableInEstimates !== false);
    const exact = activeServices.find((s) => s.name.trim().toLowerCase() === target);
    if (exact && Number(exact.basePrice) > 0) {
      return Number(exact.basePrice);
    }
    return fallback;
  };

  // Valor fixo e transparente para cada nota de condição (1 a 5)
  const getConditionScoreSurcharge = (score: number | null): number => {
    if (score === null || score <= 2) return 0;
    if (score === 3) return 10;
    if (score === 4) return 25;
    return 45; // score === 5
  };

  // Calculate pricing breakdown (100% determinístico e auditável)
  const calculation = useMemo(() => {
    // 1. Preço Base do Tipo de Limpeza (Step 2)
    const baseRate = cleaningType ? getCleaningTypePrice(cleaningType) : 0;

    // 2. Dimensões & Escopo (Step 4)
    let scopePrice = 0;
    let dimensionsPrice = 0;
    let sqFtPrice = 0;
    let bedsPrice = 0;
    let fullBathsPrice = 0;
    let halfBathsPrice = 0;
    let partialBaseTrip = 0;
    let scopeDescription = "";

    if (isPartialScope) {
      bedsPrice = partialRooms.bedrooms * 25;
      fullBathsPrice = partialRooms.fullBaths * 35;
      halfBathsPrice = partialRooms.halfBaths * 20;
      const pLiving = partialRooms.livingRoom ? 35 : 0;
      const pKitchen = partialRooms.kitchen ? 45 : 0;
      const roomsCount =
        partialRooms.bedrooms +
        partialRooms.fullBaths +
        partialRooms.halfBaths +
        (partialRooms.livingRoom ? 1 : 0) +
        (partialRooms.kitchen ? 1 : 0);

      partialBaseTrip = cleaningType ? 60 : 0;
      dimensionsPrice = bedsPrice + fullBathsPrice + halfBathsPrice + pLiving + pKitchen;
      scopePrice = partialBaseTrip + dimensionsPrice;
      scopeDescription =
        roomsCount > 0
          ? `Escopo Parcial (Taxa Base $${partialBaseTrip} + ${partialRooms.bedrooms} Qto, ${partialRooms.fullBaths} Banh, ${partialRooms.halfBaths} Lav${partialRooms.kitchen ? ", Cozinha" : ""}${partialRooms.livingRoom ? ", Sala" : ""})`
          : "Escopo Parcial (Taxa Base de Visita $60 — selecione os cômodos)";
    } else {
      // Casa Completa: Cada item adicionado no Passo 4 soma diretamente ao valor base
      sqFtPrice = sqFt > 0 ? Math.round((sqFt / 100) * 3) : 0; // +$3 a cada 100 sq ft (+$15 por 500 sq ft)
      bedsPrice = bedrooms * 20; // +$20 por quarto
      fullBathsPrice = fullBaths * 30; // +$30 por banheiro completo
      halfBathsPrice = halfBaths * 15; // +$15 por lavabo

      dimensionsPrice = sqFtPrice + bedsPrice + fullBathsPrice + halfBathsPrice;
      scopePrice = baseRate + dimensionsPrice;

      const parts: string[] = [];
      if (sqFt > 0) parts.push(`${sqFt.toLocaleString()} sq ft (+$${sqFtPrice})`);
      if (bedrooms > 0) parts.push(`${bedrooms} Quarto(s) (+$${bedsPrice})`);
      if (fullBaths > 0) parts.push(`${fullBaths} Banheiro(s) (+$${fullBathsPrice})`);
      if (halfBaths > 0) parts.push(`${halfBaths} Lavabo(s) (+$${halfBathsPrice})`);

      scopeDescription =
        parts.length > 0 ? parts.join(" • ") : "Padrão base (sem dimensões adicionais)";
    }

    // 3. Serviços Extras & Pedidos Especiais (Step 5)
    const extrasItemsList = selectedExtras.map((extraName) => {
      const def = DEFAULT_EXTRAS_CONFIG.find((d) => d.id === extraName);
      const price = getServicePrice(extraName, def?.defaultPrice || 35);
      return {
        name: extraName,
        price,
        icon: def?.icon || "✨",
      };
    });
    const extrasTotal = extrasItemsList.reduce((acc, curr) => acc + curr.price, 0);

    const customItemsTotal = customServices.reduce(
      (acc, curr) => acc + (Number(curr.price) || 0),
      0
    );

    // 4. Condição Real da Casa (Step 6) — Soma independente por fator (sem diluição por média)
    const evaluatedScores: number[] = [];
    const conditionDetails: Array<{ label: string; score: number; amount: number }> = [];

    if (conditionRatings.bathrooms !== null) {
      evaluatedScores.push(conditionRatings.bathrooms);
      const amt = getConditionScoreSurcharge(conditionRatings.bathrooms);
      if (amt > 0) {
        conditionDetails.push({
          label: "Banheiros",
          score: conditionRatings.bathrooms,
          amount: amt,
        });
      }
    }
    if (conditionRatings.roomsKitchen !== null) {
      evaluatedScores.push(conditionRatings.roomsKitchen);
      const amt = getConditionScoreSurcharge(conditionRatings.roomsKitchen);
      if (amt > 0) {
        conditionDetails.push({
          label: "Cozinha & Quartos",
          score: conditionRatings.roomsKitchen,
          amount: amt,
        });
      }
    }
    if (conditionRatings.pets !== null) {
      evaluatedScores.push(conditionRatings.pets);
      const amt = getConditionScoreSurcharge(conditionRatings.pets);
      if (amt > 0) {
        conditionDetails.push({
          label: "Pets / Pelos",
          score: conditionRatings.pets,
          amount: amt,
        });
      }
    }
    if (conditionRatings.kids !== null) {
      evaluatedScores.push(conditionRatings.kids);
      const amt = getConditionScoreSurcharge(conditionRatings.kids);
      if (amt > 0) {
        conditionDetails.push({
          label: "Crianças / Manchas",
          score: conditionRatings.kids,
          amount: amt,
        });
      }
    }

    const hasConditionEvaluation = evaluatedScores.length > 0;
    const avgCondition = hasConditionEvaluation
      ? evaluatedScores.reduce((a, b) => a + b, 0) / evaluatedScores.length
      : 1.0;

    const conditionSurcharge = conditionDetails.reduce((acc, item) => acc + item.amount, 0);
    const subtotalBeforeCondition = scopePrice + extrasTotal + customItemsTotal;
    const subtotalWithCondition = Number(
      (subtotalBeforeCondition + conditionSurcharge).toFixed(2)
    );
    const conditionMultiplier =
      subtotalBeforeCondition > 0
        ? Number((subtotalWithCondition / subtotalBeforeCondition).toFixed(2))
        : 1.0;

    // 5. Desconto de Frequência (Step 3)
    const freqConfig = FREQUENCIES.find((f) => f.id === frequency) || FREQUENCIES[0];
    const discountPercent = freqConfig.discountPercent;
    const discountAmount =
      discountPercent > 0
        ? Number(((subtotalWithCondition * discountPercent) / 100).toFixed(2))
        : 0;

    // 6. Valor Total Final Exato
    const finalTotal = Number(Math.max(0, subtotalWithCondition - discountAmount).toFixed(2));

    return {
      baseRate,
      partialBaseTrip,
      sqFtPrice,
      bedsPrice,
      fullBathsPrice,
      halfBathsPrice,
      dimensionsPrice,
      scopePrice,
      scopeDescription,
      extrasItemsList,
      extrasTotal,
      customItemsTotal,
      hasConditionEvaluation,
      avgCondition,
      conditionDetails,
      conditionMultiplier,
      conditionSurcharge,
      subtotalBeforeCondition,
      subtotalWithCondition,
      frequencyConfig: freqConfig,
      discountPercent,
      discountAmount,
      finalTotal,
    };
  }, [
    cleaningType,
    frequency,
    bedrooms,
    fullBaths,
    halfBaths,
    sqFt,
    isPartialScope,
    partialRooms,
    selectedExtras,
    customServices,
    conditionRatings,
    catalogServices,
  ]);

  // Monta o payload padronizado de itens e totais (usado tanto no rascunho quanto na emissão final)
  const buildEstimatePayload = (status: "DRAFT" | "PENDING") => {
    const typeObj = CLEANING_TYPES.find((t) => t.id === cleaningType);
    const itemsPayload: Array<{ description: string; quantity: number; unitPrice: number }> = [];

    if (isPartialScope) {
      itemsPayload.push({
        description: `${typeObj?.name || "Cleaning Service"} - ${calculation.scopeDescription}`,
        quantity: 1,
        unitPrice: Math.max(1, calculation.scopePrice),
      });
    } else {
      itemsPayload.push({
        description: `${typeObj?.name || "Cleaning Service"} (Valor Base)`,
        quantity: 1,
        unitPrice: Math.max(1, calculation.baseRate),
      });

      if (calculation.dimensionsPrice > 0) {
        itemsPayload.push({
          description: `Dimensões do Imóvel: ${calculation.scopeDescription}`,
          quantity: 1,
          unitPrice: calculation.dimensionsPrice,
        });
      }
    }

    calculation.extrasItemsList.forEach((extra) => {
      if (extra.price > 0) {
        itemsPayload.push({
          description: `Add-on: ${extra.name}`,
          quantity: 1,
          unitPrice: extra.price,
        });
      }
    });

    customServices.forEach((customItem) => {
      if (Number(customItem.price) > 0) {
        itemsPayload.push({
          description: `Serviço Especial / Incomum: ${customItem.name}`,
          quantity: 1,
          unitPrice: Number(customItem.price),
        });
      }
    });

    if (calculation.conditionSurcharge > 0) {
      const detailsText = calculation.conditionDetails
        .map((d) => `${d.label} Nível ${d.score} (+$${d.amount})`)
        .join(", ");
      itemsPayload.push({
        description: `Ajuste de Condição / Esforço da Casa (${detailsText})`,
        quantity: 1,
        unitPrice: calculation.conditionSurcharge,
      });
    }

    const estimatedDuration = calculateEstimateDuration({
      cleaningType,
      bedrooms,
      fullBaths,
      halfBaths,
      sqFt,
      isPartialScope,
      selectedExtras,
      customServices,
      conditionRatings,
    });

    return {
      clientId: selectedClient.id,
      estimateNumber: estimateNumber.trim() || `EST-${Date.now().toString().slice(-4)}`,
      status,
      estimatedDurationMinutes: estimatedDuration,
      validUntil: `${validUntil}T23:59:59Z`,
      discount: calculation.discountAmount,
      notes: notes.trim() || undefined,
      metadata: {
        cleaningType,
        frequency,
        sqFt,
        bedrooms,
        fullBaths,
        halfBaths,
        isPartialScope,
        partialRooms: isPartialScope ? partialRooms : undefined,
        selectedExtras,
        customServices,
        conditionRatings,
        conditionDetails: calculation.conditionDetails,
        conditionMultiplier: calculation.conditionMultiplier,
        conditionSurcharge: calculation.conditionSurcharge,
        discountPercent: calculation.discountPercent,
        discountAmount: calculation.discountAmount,
        subtotalWithCondition: calculation.subtotalWithCondition,
        finalTotal: calculation.finalTotal,
        estimatedDurationMinutes: estimatedDuration,
        isSilentDraft: status === "DRAFT",
      },
      items: itemsPayload,
    };
  };

  // Silent Draft Auto-Save for Abandoned Recovery (Só salva/atualiza quando já existe tipo de limpeza selecionado)
  const saveSilentDraft = async () => {
    if (!selectedClient?.id || !cleaningType) return;
    try {
      const draftPayload = buildEstimatePayload("DRAFT");

      if (!silentDraftId) {
        const res = await fetch("/api/v1/estimates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data?.id) setSilentDraftId(json.data.id);
        }
      } else {
        await fetch(`/api/v1/estimates/${silentDraftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        });
      }
    } catch {
      // Falha silenciosa proposital
    }
  };

  // Filtered clients for Step 1
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 6);
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  // Quick Client Creation
  const handleCreateNewClient = async () => {
    if (!newClientForm.name.trim() || !newClientForm.address.trim()) {
      setError("Informe ao menos o nome completo e endereço do novo cliente.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientForm.name.trim(),
          address: newClientForm.address.trim(),
          phone: newClientForm.phone.trim() || undefined,
          email: newClientForm.email.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao cadastrar cliente.");
      }
      setSelectedClient(json.data);
      setIsCreatingNewClient(false);
      setClients((prev) => [json.data, ...prev]);
    } catch (e: any) {
      setError(e.message || "Erro ao cadastrar cliente.");
    }
  };

  // Generate English proposal text
  const generateProposalText = () => {
    const clientName = selectedClient?.name || "Customer";
    const typeLabel =
      CLEANING_TYPES.find((t) => t.id === cleaningType)?.name || "Professional Cleaning";
    const freqLabel = calculation.frequencyConfig.name;

    const extrasText =
      calculation.extrasItemsList.length > 0
        ? `\n- Included Extra Services: ${calculation.extrasItemsList.map((e) => `${e.name} (+$${e.price})`).join(", ")}`
        : "";

    const customText =
      customServices.length > 0
        ? `\n- Special Requests: ${customServices.map((c) => `${c.name} (+$${c.price})`).join(", ")}`
        : "";

    return `Hi ${clientName}! Thank you for choosing our cleaning services. ✨\n\nHere is your custom quote:\n• Service: ${typeLabel} (${freqLabel})\n• Home Scope: ${calculation.scopeDescription}${extrasText}${customText}\n• Total Estimated Price: $${calculation.finalTotal.toFixed(2)}${
      calculation.discountAmount > 0
        ? ` (Includes ${calculation.discountPercent}% recurring frequency discount of -$${calculation.discountAmount.toFixed(2)}!)`
        : ""
    }\n\nAll professional supplies and equipment are fully provided. Would you like us to schedule your first visit? Let us know what day works best for you! 🧹🧼`;
  };

  const handleCopyProposal = () => {
    navigator.clipboard.writeText(generateProposalText());
    setAiProposalCopied(true);
    setTimeout(() => setAiProposalCopied(false), 2500);
  };

  // Final Submit (Atualiza o rascunho se já existir para evitar duplicidade, ou cria novo)
  const handleFinalSubmit = async () => {
    if (!selectedClient?.id) {
      setError("Selecione um cliente no Passo 1 antes de finalizar.");
      setCurrentStep(1);
      return;
    }
    if (!cleaningType) {
      setError("Selecione o tipo de limpeza no Passo 2 antes de finalizar.");
      setCurrentStep(2);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildEstimatePayload("PENDING");

      const url = silentDraftId
        ? `/api/v1/estimates/${silentDraftId}`
        : "/api/v1/estimates";
      const method = silentDraftId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar orçamento.");
      }

      onSuccess?.(json.data);
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao salvar orçamento.");
    } finally {
      setSaving(false);
    }
  };

  const stepsList = [
    { num: 1, name: "Cliente" },
    { num: 2, name: "Tipo" },
    { num: 3, name: "Frequência" },
    { num: 4, name: "Dimensões" },
    { num: 5, name: "Extras" },
    { num: 6, name: "Condição" },
    { num: 7, name: "Resumo" },
  ];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<Receipt className="w-5 h-5 text-amber-600" />}
      title="Calculador & Wizard de Orçamentos"
      subtitle="Monte orçamentos sob medida com ajuste fino pela condição real do imóvel"
      panelClassName="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 my-6 space-y-5 max-h-[92vh] flex flex-col justify-between"
      iconWrapperClassName="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80"
    >
      <div className="flex-1 overflow-y-auto pr-1 space-y-5">
        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2.5 text-xs font-semibold"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Stepper Progress Bar com Linha Conectora Animada */}
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
          {/* Header do Stepper: Passo atual e Porcentagem */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
            <span className="flex items-center gap-1.5">
              <span>Etapa {currentStep} de 7:</span>
              <strong className="text-slate-900 font-bold">{stepsList[currentStep - 1].name}</strong>
            </span>
            <span className="font-mono text-amber-700 font-bold text-[11px] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
              {Math.round(((currentStep - 1) / 6) * 100)}% concluído
            </span>
          </div>

          {/* Stepper Nodes com Barra de Progresso Traseira Conectora */}
          <div className="relative flex items-center justify-between px-2 sm:px-3">
            {/* Linha Cinza de Fundo */}
            <div className="absolute left-5 right-5 top-2.5 h-0.5 bg-slate-200/90 -z-0" />

            {/* Linha Ativa de Progresso com Preenchimento Gradiente Animado */}
            <div
              className="absolute left-5 top-2.5 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600 -z-0 transition-all duration-300 ease-out"
              style={{
                width: `calc(${((currentStep - 1) / 6) * 100}% * ((100% - 40px) / 100))`,
              }}
            />

            {stepsList.map((s) => {
              const isActive = currentStep === s.num;
              const isPast = currentStep > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num === 1 || selectedClient?.id) {
                      setCurrentStep(s.num);
                    }
                  }}
                  className={`relative z-10 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    isActive ? "scale-105" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  {/* Círculo do Nó com tamanho reduzido em 50% */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shadow-2xs ${
                      isActive
                        ? "bg-amber-600 text-white ring-4 ring-amber-200 font-black"
                        : isPast
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-slate-400 border border-slate-300"
                    }`}
                  >
                    {isPast ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : s.num}
                  </div>
                  <span
                    className={`text-[9px] sm:text-[10px] font-semibold hidden sm:block ${
                      isActive
                        ? "text-amber-800 font-black"
                        : isPast
                        ? "text-emerald-700 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP CONTENT CONTAINER */}
        <div className="min-h-[300px]">
          {/* STEP 1: CLIENTE */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-600" />
                  <span>Para quem vamos preparar este orçamento?</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Localize um cliente já cadastrado ou adicione os dados de um novo cliente.
                </p>
              </div>

              {selectedClient ? (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Cliente Selecionado
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1.5">
                      {selectedClient.name}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">{selectedClient.address}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedClient.phone || "Sem telefone"} • {selectedClient.email || "Sem email"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(null)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-bold underline cursor-pointer"
                  >
                    Trocar Cliente
                  </button>
                </div>
              ) : isCreatingNewClient ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Cadastrar Novo Cliente
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewClient(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Emily Watson"
                        value={newClientForm.name}
                        onChange={(e) =>
                          setNewClientForm({ ...newClientForm, name: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Telefone (Celular / WhatsApp) *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: (970) 555-0192"
                        value={newClientForm.phone}
                        onChange={(e) =>
                          setNewClientForm({ ...newClientForm, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Endereço Completo do Imóvel *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 3410 W 24th St, Greeley, CO 80634"
                        value={newClientForm.address}
                        onChange={(e) =>
                          setNewClientForm({ ...newClientForm, address: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        E-mail (opcional)
                      </label>
                      <input
                        type="email"
                        placeholder="Ex: emily@gmail.com"
                        value={newClientForm.email}
                        onChange={(e) =>
                          setNewClientForm({ ...newClientForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNewClient}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Salvar e Selecionar Cliente
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por nome, telefone ou endereço..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-2xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewClient(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Novo Cliente</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredClients.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedClient(c)}
                        className="p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 cursor-pointer transition-all flex flex-col justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 text-xs block truncate">
                            {c.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                            {c.address || "Sem endereço cadastrado"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                          {c.phone || c.email || ""}
                        </span>
                      </div>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="col-span-2 p-6 text-center text-xs text-slate-400">
                        Nenhum cliente encontrado. Clique em "+ Novo Cliente" para cadastrar.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: TIPO DE LIMPEZA */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Qual o padrão de serviço desejado?</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique para selecionar o tipo de limpeza. Os valores são atualizados na hora.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {CLEANING_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = cleaningType === type.id;
                  const price = getCleaningTypePrice(
                    type.id as "STANDARD" | "DEEP" | "MOVE_IN_OUT"
                  );

                  return (
                    <div
                      key={type.id}
                      onClick={() => {
                        setCleaningType(type.id as any);
                        setError(null);
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                        isSelected
                          ? "bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      {type.badge && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-amber-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-xs">
                          {type.badge}
                        </span>
                      )}
                      <div>
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                            isSelected
                              ? "bg-amber-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{type.name}</h4>
                        <span className="text-[11px] font-medium text-amber-700 block mt-0.5">
                          {type.subtitle}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                          {type.desc}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          Base a partir de
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          ${price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 3: FREQUÊNCIA DE LIMPEZA */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-amber-600" />
                  <span>Com que frequência o serviço será realizado?</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Planos recorrentes oferecem descontos automáticos que fidelizam o cliente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {FREQUENCIES.map((freq) => {
                  const isSelected = frequency === freq.id;
                  return (
                    <div
                      key={freq.id}
                      onClick={() => setFrequency(freq.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{freq.name}</span>
                          {freq.badge && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded-full uppercase tracking-wider">
                              {freq.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block">{freq.subtitle}</span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black ${
                            freq.discountPercent > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {freq.discountLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 4: DIMENSÕES & ESCOPO (Todos iniciam zerados) */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-amber-600" />
                    <span>Dimensões e Escopo do Imóvel</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Informe os quartos, banheiros e tamanho total, ou ative limpeza parcial por cômodo.
                  </p>
                </div>

                {/* Toggle Partial Scope */}
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                  <input
                    type="checkbox"
                    checked={isPartialScope}
                    onChange={(e) => setIsPartialScope(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 accent-amber-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Limpeza Parcial (Custom Scope)
                  </span>
                </label>
              </div>

              {isPartialScope ? (
                /* PARTIAL ROOMS SELECTION (Iniciando zerados) */
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-4">
                  <div className="flex items-center justify-between gap-2 text-amber-900 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Limpeza parcial por cômodo (Taxa base de deslocamento:{" "}
                        <strong>$60.00</strong>)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-800">
                      Escopo: ${calculation.scopePrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Bedrooms */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Quartos para Limpar</span>
                        <span className="text-[10px] text-slate-500">+$25.00 por quarto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPartialRooms((p) => ({
                              ...p,
                              bedrooms: Math.max(0, p.bedrooms - 1),
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900">
                          {partialRooms.bedrooms}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPartialRooms((p) => ({
                              ...p,
                              bedrooms: p.bedrooms + 1,
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Full Baths */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Banheiros Completos</span>
                        <span className="text-[10px] text-slate-500">+$35.00 por banheiro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPartialRooms((p) => ({
                              ...p,
                              fullBaths: Math.max(0, p.fullBaths - 1),
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900">
                          {partialRooms.fullBaths}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPartialRooms((p) => ({
                              ...p,
                              fullBaths: p.fullBaths + 1,
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Half Baths */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Lavabos (Half Baths)</span>
                        <span className="text-[10px] text-slate-500">+$20.00 por lavabo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPartialRooms((p) => ({
                              ...p,
                              halfBaths: Math.max(0, p.halfBaths - 1),
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900">
                          {partialRooms.halfBaths}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPartialRooms((p) => ({
                              ...p,
                              halfBaths: p.halfBaths + 1,
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Kitchen */}
                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-slate-800 block">Cozinha (Kitchen)</span>
                        <span className="text-[10px] text-slate-500">+$45.00</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={partialRooms.kitchen}
                        onChange={(e) =>
                          setPartialRooms((p) => ({ ...p, kitchen: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 accent-amber-600 cursor-pointer"
                      />
                    </label>

                    {/* Living Room */}
                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer sm:col-span-2">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          Sala de Estar / Jantar (Living Room)
                        </span>
                        <span className="text-[10px] text-slate-500">+$35.00</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={partialRooms.livingRoom}
                        onChange={(e) =>
                          setPartialRooms((p) => ({ ...p, livingRoom: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 accent-amber-600 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* FULL HOUSE CONTROLS (Iniciando zerados) */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {/* Sq Ft */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">Área Total do Imóvel (Sq Ft)</span>
                        <span className="text-[10px] text-slate-500 ml-2">
                          (+$3.00 a cada 100 sq ft)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-700 text-sm">
                        {sqFt > 0
                          ? `${sqFt.toLocaleString()} sq ft (+$${calculation.sqFtPrice.toFixed(2)})`
                          : "0 (Padrão base)"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6000"
                      step="100"
                      value={sqFt}
                      onChange={(e) => setSqFt(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>0</span>
                      <span>1.500 (+$45)</span>
                      <span>3.000 (+$90)</span>
                      <span>4.500 (+$135)</span>
                      <span>6.000 (+$180)</span>
                    </div>
                  </div>

                  {/* Bedrooms */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Quartos (Bedrooms)</span>
                      <span className="text-[11px] text-slate-500">
                        +$20.00 por quarto
                        {bedrooms > 0 ? ` (+$${calculation.bedsPrice.toFixed(2)})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBedrooms((b) => Math.max(0, b - 1))}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 shadow-2xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-bold font-mono text-base text-slate-900">
                        {bedrooms}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBedrooms((b) => b + 1)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Full Bathrooms */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">Banheiros Completos</span>
                      <span className="text-[11px] text-slate-500">
                        +$30.00 por banheiro
                        {fullBaths > 0 ? ` (+$${calculation.fullBathsPrice.toFixed(2)})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFullBaths((b) => Math.max(0, b - 1))}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 shadow-2xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-bold font-mono text-base text-slate-900">
                        {fullBaths}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFullBaths((b) => b + 1)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Half Bathrooms */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between sm:col-span-2">
                    <div>
                      <span className="font-bold text-slate-800 block">Lavabos (Half Baths)</span>
                      <span className="text-[11px] text-slate-500">
                        +$15.00 por lavabo
                        {halfBaths > 0 ? ` (+$${calculation.halfBathsPrice.toFixed(2)})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHalfBaths((b) => Math.max(0, b - 1))}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 shadow-2xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-bold font-mono text-base text-slate-900">
                        {halfBaths}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHalfBaths((b) => b + 1)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 5: SERVIÇOS EXTRAS */}
          {currentStep === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Deseja adicionar algum serviço extra?</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique para marcar ou desmarcar. Os valores são configurados no catálogo de serviços.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DEFAULT_EXTRAS_CONFIG.map((extra) => {
                  const isSelected = selectedExtras.includes(extra.id);
                  const price = getServicePrice(extra.name, extra.defaultPrice);

                  return (
                    <div
                      key={extra.id}
                      onClick={() => {
                        setSelectedExtras((prev) =>
                          isSelected ? prev.filter((id) => id !== extra.id) : [...prev, extra.id]
                        );
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left relative ${
                        isSelected
                          ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{extra.icon}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "bg-amber-600 border-amber-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-900 text-xs block leading-tight">
                          {extra.name}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-700 block mt-1">
                          +${price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Seção de Pedidos Especiais & Serviços Incomuns (com IA) */}
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/60 border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Pedidos Especiais & Serviços Incomuns (com IA)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        O cliente pediu algo fora do padrão? Digite abaixo e a IA identifica cada serviço com valor sugerido de $20 (editável).
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200">
                    Smart AI Parser
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleParseCustomServicesWithAI();
                      }
                    }}
                    placeholder="Ex: varrer garagem, limpar coifa, passar aspirador no sótão, limpar rodapé..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleParseCustomServicesWithAI}
                    disabled={isParsingAI || !customPrompt.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    {isParsingAI ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Identificando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Interpretar com IA</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Lista de Serviços Incomuns Identificados */}
                {customServices.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-indigo-100/80">
                    <span className="text-[11px] font-bold text-indigo-900 block">
                      Serviços Especiais Identificados ({customServices.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {customServices.map((cs) => (
                        <div
                          key={cs.id}
                          className="p-2.5 rounded-xl bg-white border border-indigo-200/90 shadow-2xs flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">🪄</span>
                            <span className="text-xs font-semibold text-slate-800 truncate" title={cs.name}>
                              {cs.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateCustomServicePrice(cs.id, cs.price - 5)}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold"
                            >
                              -
                            </button>
                            <div className="relative">
                              <span className="text-[11px] font-mono font-bold text-slate-500 absolute left-2 top-1/2 -translate-y-1/2">
                                $
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={cs.price}
                                onChange={(e) => updateCustomServicePrice(cs.id, Number(e.target.value) || 0)}
                                className="w-16 pl-4 pr-1 py-1 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-xs text-indigo-700 text-right focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => updateCustomServicePrice(cs.id, cs.price + 5)}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCustomService(cs.id)}
                              className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors ml-1 cursor-pointer"
                              title="Remover serviço"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 6: SITUAÇÃO DA CASA (Inicia desabilitado/não selecionado) */}
          {currentStep === 6 && (
            <motion.div
              key="step-6"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Qual o estado real de conservação e sujeira da casa?</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escala de 1 a 5 por categoria. Cada categoria é independente (Nível 1–2 = +$0, Nível 3 = +$10, Nível 4 = +$25, Nível 5 = +$45).
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. Banheiros */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        🚿 Estado dos Banheiros (Calcário / Limo / Azulejos)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {conditionRatings.bathrooms === null && "Nenhuma condição selecionada (+$0.00)"}
                        {conditionRatings.bathrooms === 1 && "1: Impecável / Muito limpo (+$0.00)"}
                        {conditionRatings.bathrooms === 2 && "2: Limpo / Uso leve (+$0.00)"}
                        {conditionRatings.bathrooms === 3 && "3: Uso moderado / Calcário leve (+$10.00)"}
                        {conditionRatings.bathrooms === 4 && "4: Sujeira acumulada / Calcário pesado (+$25.00)"}
                        {conditionRatings.bathrooms === 5 && "5: Crítico / Limo e mofo acumulado (+$45.00)"}
                      </span>
                    </div>
                    {conditionRatings.bathrooms !== null && (
                      <button
                        type="button"
                        onClick={() => setConditionRatings((prev) => ({ ...prev, bathrooms: null }))}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const fee = getConditionScoreSurcharge(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setConditionRatings((prev) => ({
                              ...prev,
                              bathrooms: prev.bathrooms === val ? null : val,
                            }))
                          }
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                            conditionRatings.bathrooms === val
                              ? val >= 4
                                ? "bg-rose-600 text-white shadow-xs font-black"
                                : val === 3
                                ? "bg-amber-600 text-white shadow-xs font-black"
                                : "bg-emerald-600 text-white shadow-xs font-black"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span>{val}</span>
                          <span className="text-[9px] opacity-80 font-mono">
                            {fee > 0 ? `+$${fee}` : "+$0"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Cozinha e Quartos */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        🍳 Cozinha, Gordura & Organização dos Quartos
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {conditionRatings.roomsKitchen === null && "Nenhuma condição selecionada (+$0.00)"}
                        {conditionRatings.roomsKitchen === 1 && "1: Muito organizado / Superfícies livres (+$0.00)"}
                        {conditionRatings.roomsKitchen === 2 && "2: Pouca desordem (+$0.00)"}
                        {conditionRatings.roomsKitchen === 3 && "3: Uso moderado / Gordura leve (+$10.00)"}
                        {conditionRatings.roomsKitchen === 4 && "4: Muita gordura / Bastante desordem (+$25.00)"}
                        {conditionRatings.roomsKitchen === 5 && "5: Crítico / Gordura antiga e desordem pesada (+$45.00)"}
                      </span>
                    </div>
                    {conditionRatings.roomsKitchen !== null && (
                      <button
                        type="button"
                        onClick={() => setConditionRatings((prev) => ({ ...prev, roomsKitchen: null }))}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const fee = getConditionScoreSurcharge(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setConditionRatings((prev) => ({
                              ...prev,
                              roomsKitchen: prev.roomsKitchen === val ? null : val,
                            }))
                          }
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                            conditionRatings.roomsKitchen === val
                              ? val >= 4
                                ? "bg-rose-600 text-white shadow-xs font-black"
                                : val === 3
                                ? "bg-amber-600 text-white shadow-xs font-black"
                                : "bg-emerald-600 text-white shadow-xs font-black"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span>{val}</span>
                          <span className="text-[9px] opacity-80 font-mono">
                            {fee > 0 ? `+$${fee}` : "+$0"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Pets / Pelos */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        🐾 Presença de Animais (Pelos / Odores)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {conditionRatings.pets === null && "Nenhuma condição selecionada (+$0.00)"}
                        {conditionRatings.pets === 1 && "1: Sem pets / Sem pelos (+$0.00)"}
                        {conditionRatings.pets === 2 && "2: 1 pet pequeno / Pouco pelo (+$0.00)"}
                        {conditionRatings.pets === 3 && "3: Pelos moderados em estofados (+$10.00)"}
                        {conditionRatings.pets === 4 && "4: Muito pelo acumulado / Carpetes carregados (+$25.00)"}
                        {conditionRatings.pets === 5 && "5: Múltiplos cães/gatos soltando muito pelo (+$45.00)"}
                      </span>
                    </div>
                    {conditionRatings.pets !== null && (
                      <button
                        type="button"
                        onClick={() => setConditionRatings((prev) => ({ ...prev, pets: null }))}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const fee = getConditionScoreSurcharge(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setConditionRatings((prev) => ({
                              ...prev,
                              pets: prev.pets === val ? null : val,
                            }))
                          }
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                            conditionRatings.pets === val
                              ? val >= 4
                                ? "bg-rose-600 text-white shadow-xs font-black"
                                : val === 3
                                ? "bg-amber-600 text-white shadow-xs font-black"
                                : "bg-emerald-600 text-white shadow-xs font-black"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span>{val}</span>
                          <span className="text-[9px] opacity-80 font-mono">
                            {fee > 0 ? `+$${fee}` : "+$0"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Crianças / Manchas */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        👶 Crianças / Marcas nas Paredes & Desordem
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {conditionRatings.kids === null && "Nenhuma condição selecionada (+$0.00)"}
                        {conditionRatings.kids === 1 && "1: Sem crianças / Paredes limpas (+$0.00)"}
                        {conditionRatings.kids === 2 && "2: Marcas leves ocasionais (+$0.00)"}
                        {conditionRatings.kids === 3 && "3: Marcas moderadas de brinquedos (+$10.00)"}
                        {conditionRatings.kids === 4 && "4: Muitas marcas e desordem (+$25.00)"}
                        {conditionRatings.kids === 5 && "5: Paredes e pisos com rabiscos/manchas pesadas (+$45.00)"}
                      </span>
                    </div>
                    {conditionRatings.kids !== null && (
                      <button
                        type="button"
                        onClick={() => setConditionRatings((prev) => ({ ...prev, kids: null }))}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const fee = getConditionScoreSurcharge(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setConditionRatings((prev) => ({
                              ...prev,
                              kids: prev.kids === val ? null : val,
                            }))
                          }
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                            conditionRatings.kids === val
                              ? val >= 4
                                ? "bg-rose-600 text-white shadow-xs font-black"
                                : val === 3
                                ? "bg-amber-600 text-white shadow-xs font-black"
                                : "bg-emerald-600 text-white shadow-xs font-black"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span>{val}</span>
                          <span className="text-[9px] opacity-80 font-mono">
                            {fee > 0 ? `+$${fee}` : "+$0"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 7: RESUMO & PROPOSTA FINAL */}
          {currentStep === 7 && (
            <motion.div
              key="step-7"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resumo da Proposta e Cálculo Final</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Revise os itens discriminados, termos e gere a mensagem para o cliente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyProposal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                >
                  {aiProposalCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado em Inglês!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Proposta em Inglês (SMS/WhatsApp)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Detailed Breakdown Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                {/* Client snapshot */}
                <div className="flex justify-between items-center border-b border-slate-200/80 pb-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Cliente</span>
                    <h5 className="font-bold text-slate-900">{selectedClient?.name}</h5>
                    <span className="text-[11px] text-slate-500">{selectedClient?.address}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Nº Orçamento</span>
                    <span className="font-mono font-bold text-slate-800 block">{estimateNumber}</span>
                  </div>
                </div>

                {/* Line items list */}
                <div className="space-y-2 py-1">
                  {!isPartialScope ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800">
                            {CLEANING_TYPES.find((t) => t.id === cleaningType)?.name || "Serviço de Limpeza"} (Taxa Base)
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Plano: {calculation.frequencyConfig.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          ${calculation.baseRate.toFixed(2)}
                        </span>
                      </div>

                      {calculation.dimensionsPrice > 0 && (
                        <div className="flex items-center justify-between pl-3 border-l-2 border-slate-300">
                          <div>
                            <span className="font-semibold text-slate-800">
                              Dimensões do Imóvel
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {calculation.scopeDescription}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">
                            +${calculation.dimensionsPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">
                          {CLEANING_TYPES.find((t) => t.id === cleaningType)?.name || "Serviço de Limpeza"} (Escopo Parcial)
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {calculation.scopeDescription}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        ${calculation.scopePrice.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {calculation.extrasItemsList.map((extra) => (
                    <div key={extra.name} className="flex items-center justify-between pl-3 border-l-2 border-amber-300">
                      <span className="text-slate-700">
                        {extra.icon} {extra.name}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        +${extra.price.toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {customServices.map((cs) => (
                    <div key={cs.id} className="flex items-center justify-between pl-3 border-l-2 border-indigo-400">
                      <span className="text-slate-700">
                        🪄 {cs.name} <span className="text-[10px] text-indigo-600 font-semibold">(Incomum / Especial)</span>
                      </span>
                      <span className="font-mono font-bold text-indigo-700">
                        +${cs.price.toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {calculation.conditionSurcharge > 0 && (
                    <div className="flex items-center justify-between pl-3 border-l-2 border-rose-400">
                      <div>
                        <span className="font-semibold text-rose-800">
                          Ajuste de Esforço / Condição da Casa
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {calculation.conditionDetails
                            .map((d) => `${d.label} Nível ${d.score} (+$${d.amount})`)
                            .join(" • ")}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-rose-700">
                        +${calculation.conditionSurcharge.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {calculation.discountAmount > 0 && (
                    <div className="flex items-center justify-between pl-3 border-l-2 border-emerald-400">
                      <div>
                        <span className="font-semibold text-emerald-800">
                          Desconto de Recorrência ({calculation.frequencyConfig.name})
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          {calculation.discountPercent}% OFF sobre ${calculation.subtotalWithCondition.toFixed(2)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">
                        -${calculation.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Total Line */}
                <div className="pt-3 border-t-2 border-slate-300 flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">
                    Valor Total do Orçamento:
                  </span>
                  <span className="font-mono font-black text-2xl text-amber-700">
                    ${calculation.finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Meta: Validade & Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Válido Até
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Termos & Notas para a Proposta
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* FOOTER & NAVIGATION CONTROLS */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Real-Time Price Pill: SOMENTE aparece a partir da etapa 2 quando o tipo de limpeza foi selecionado */}
        <div>
          {currentStep > 1 && cleaningType !== "" ? (
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-amber-900">Total Estimado:</span>
                <span className="text-base font-black font-mono text-amber-800">
                  ${calculation.finalTotal.toFixed(2)}
                </span>
              </div>
              {calculation.discountAmount > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  Economia de ${calculation.discountAmount.toFixed(2)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {currentStep === 1
                ? "Selecione o cliente para iniciar o orçamento"
                : "Selecione um tipo de limpeza acima para calcular"}
            </span>
          )}
        </div>

        {/* Back and Next Buttons */}
        <div className="flex items-center justify-end gap-2">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={saving}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          )}

          {currentStep < 7 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !selectedClient?.id) {
                  setError("Selecione um cliente para prosseguir.");
                  return;
                }
                if (currentStep === 2 && !cleaningType) {
                  setError("Selecione um dos tipos de limpeza para prosseguir.");
                  return;
                }
                setError(null);
                saveSilentDraft();
                setCurrentStep((s) => Math.min(7, s + 1));
              }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              <span>Próximo Passo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Orçamento...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Salvar e Emitir Orçamento</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
