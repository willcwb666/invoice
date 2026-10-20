"use client";

import React from "react";
import { motion } from "framer-motion";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

const KNOWN_FEMALE_NAMES = new Set([
  "renata", "maria", "ana", "julia", "leticia", "camila", "amanda", "bruna",
  "jessica", "fernanda", "patricia", "aline", "juliana", "mariana", "vanessa",
  "carolina", "caroline", "gabriela", "rafaela", "daniela", "priscila", "tatiane",
  "tatiana", "adriana", "luciana", "cristiane", "cristina", "claudia", "sandra",
  "marcia", "sonia", "simone", "debora", "raquel", "larissa", "beatriz", "bianca",
  "natalia", "thais", "luana", "isabela", "isabella", "laura", "alice", "valentina",
  "helena", "manuela", "sophia", "sofia", "heloisa", "luiza", "cecilia", "maite",
  "elisa", "liz", "livia", "lorena", "emily", "peeyoosha", "prajakta", "marie",
  "sarah", "ashley", "nicole", "jhennifer", "jennifer", "tamika", "donna", "susan",
  "karen", "lisa", "nancy", "betty", "margaret", "kimberly", "michelle", "carol",
  "melissa", "deborah", "stephanie", "rebecca", "sharon", "cynthia", "kathleen",
  "amy", "angela", "shirley", "anna", "brenda", "pamela", "emma", "helen",
  "samantha", "katherine", "christine", "debra", "rachel", "carolyn", "janet",
  "catherine", "heather", "diane", "julie", "joyce", "victoria", "kelly", "lauren",
  "joan", "evelyn", "judith", "megan", "andrea", "cheryl", "hannah", "jacqueline",
  "martha", "gloria", "teresa", "ann", "sara", "madison", "frances", "kathryn",
  "janice", "jean", "abigail", "judy", "allison", "grace", "raissa", "rayssa",
  "yasmin", "yasmim", "vitoria", "flavia", "viviane", "elaine", "sueli", "vera",
  "regina", "silvia", "monica", "denise", "rosangela", "solange", "jaqueline",
  "franciele", "michele", "sabrina", "natalie", "claire", "olivia", "chloe",
]);

const KNOWN_MALE_NAMES = new Set([
  "renato", "josh", "joshua", "joao", "carlos", "pedro", "lucas", "mateus",
  "matheus", "gabriel", "rafael", "daniel", "marcos", "paulo", "felipe", "bruno",
  "rodrigo", "gustavo", "andre", "diego", "thiago", "tiago", "leonardo", "eduardo",
  "ricardo", "fernando", "alexandre", "julio", "cesar", "henrique", "vitor",
  "victor", "samuel", "david", "davi", "jose", "antonio", "francisco", "luiz",
  "luis", "guilherme", "leandro", "marcelo", "fabio", "flavio", "sergio", "roberto",
  "marcio", "vinicius", "caio", "igor", "renan", "diogo", "danilo", "wesley",
  "willian", "william", "michael", "john", "james", "robert", "richard", "thomas",
  "charles", "christopher", "matthew", "anthony", "mark", "steven", "paul",
  "andrew", "kenneth", "kevin", "brian", "george", "timothy", "ronald", "jason",
  "edward", "jeffrey", "ryan", "jacob", "gary", "nicholas", "eric", "jonathan",
  "stephen", "larry", "justin", "scott", "brandon", "benjamin", "adam", "gregory",
  "alexander", "patrick", "frank", "raymond", "jack", "dennis", "jerry", "luca",
]);

function isFemaleName(rawFirstName: string): boolean {
  const normalized = rawFirstName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) return true;
  if (KNOWN_MALE_NAMES.has(normalized)) return false;
  if (KNOWN_FEMALE_NAMES.has(normalized)) return true;

  // Heurística padrão para nomes em português/inglês
  if (normalized.endsWith("a") || normalized.endsWith("e") && normalized.endsWith("elle") || normalized.endsWith("ane") || normalized.endsWith("ine")) {
    return true;
  }
  return false;
}

export function WelcomeBanner() {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="pt-6 sm:pt-7">
        <div className="rounded-2xl bg-[#f3f4f6] border border-slate-200/80 px-6 sm:px-10 py-6 sm:py-7 flex items-center justify-between shadow-2xs h-[106px] sm:h-[114px] animate-pulse">
          <div className="space-y-2">
            <div className="h-7 sm:h-8 w-44 bg-slate-200/80 rounded-lg" />
            <div className="h-3.5 sm:h-4 w-56 bg-slate-200/60 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  const fullName = user?.name || "Bem-vindo";
  const firstName = fullName.trim().split(" ")[0];
  const isFemale =
    user?.gender
      ? user.gender.toUpperCase() === "FEMALE"
      : isFemaleName(firstName);

  return (
    <div className="pt-6 sm:pt-7">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative rounded-2xl bg-[#f3f4f6] border border-slate-200/80 px-6 sm:px-10 py-6 sm:py-7 flex items-center justify-between shadow-2xs overflow-visible"
      >
        {/* Texto de Boas-vindas (Esquerda) */}
        <div className="space-y-1 z-10 max-w-[65%] sm:max-w-md">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Olá, {firstName}!
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-600">
            É muito bom ver você novamente.
          </p>
        </div>

        {/* Espaço reservado para manter o layout alinhado */}
        <div className="w-28 sm:w-44 h-8 shrink-0" />

        {/* Ilustração Minimalista Acenando (Direita, vazando no topo como na referência) */}
        <div className="absolute bottom-0 right-4 sm:right-12 md:right-20 pointer-events-none select-none">
          {isFemale ? (
            /* ============================================================ */
            /* VERSÃO FEMININA (Mesmo traço minimalista P&B do bonequinho)  */
            /* ============================================================ */
            <svg
              width="168"
              height="148"
              viewBox="0 0 180 155"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-36 h-32 sm:w-44 sm:h-36 block"
            >
              {/* Cabelo Longo Traseiro (Caindo suavemente até os ombros) */}
              <path
                d="M82 42 C75 62 74 92 80 112 C84 118 96 118 112 118 C128 118 140 118 144 112 C150 92 149 62 142 42 Z"
                fill="#111827"
              />

              {/* Braço Esquerdo Acenando (Com animação suave de aceno) */}
              <motion.g
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 7, -4, 7, 0] }}
                transition={{
                  duration: 2.2,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 4,
                }}
                style={{ originX: "78px", originY: "135px" }}
              >
                {/* Antebraço e Mão Acenando */}
                <path
                  d="M74 146 L55 104 L43 84"
                  stroke="#111827"
                  strokeWidth="11.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M74 146 L55 104 L43 84"
                  stroke="#ffffff"
                  strokeWidth="7.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Palma e Dedos da Mão */}
                <g transform="translate(22, 50)">
                  <path
                    d="M14 28 C11 28 9 24 10 19 L12 13 C13 11 26 11 27 14 L29 22 C30 26 26 31 21 31 Z"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.3"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11 19 L6 10 C5 8 8 6 9.5 8.5 L14 16"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 15 L11 4 C10.5 1.5 14 1 14.8 3.5 L17.5 14"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18 14 L18 2 C18 -0.5 21.5 -0.5 21.5 2 L21.5 14"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 15 L25 4.5 C25.8 2 29 3 28 5.5 L25 16"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M26 20 L33 15 C35 13.5 37 16.5 35 18.5 L28 25"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 22 Q21 20 24 24"
                    stroke="#111827"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </g>
              </motion.g>

              {/* Braço Direito (descendo na lateral direita) */}
              <path
                d="M146 128 L151 155"
                stroke="#111827"
                strokeWidth="12.5"
                strokeLinecap="round"
              />
              <path
                d="M146 128 L151 155"
                stroke="#ffffff"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Blusa Preta Feminina / Tronco */}
              <path
                d="M73 128 C79 112 92 108 112 108 C132 108 144 113 150 128 L156 155 L66 155 Z"
                fill="#111827"
              />
              {/* Manga Esquerda */}
              <path
                d="M77 116 L60 132 L69 147 L85 134 Z"
                fill="#111827"
              />

              {/* Pescoço e Gola Feminina em V suave */}
              <path
                d="M105 86 L105 109 L112 117 L119 109 L119 86 Z"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />

              {/* Orelha Esquerda + Brinco */}
              <circle
                cx="85"
                cy="58"
                r="5.5"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              <circle
                cx="84.5"
                cy="65"
                r="2.2"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="1.8"
              />

              {/* Orelha Direita + Brinco */}
              <circle
                cx="139"
                cy="58"
                r="5.5"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              <circle
                cx="139.5"
                cy="65"
                r="2.2"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="1.8"
              />

              {/* Rosto / Cabeça */}
              <rect
                x="87"
                y="26"
                width="50"
                height="65"
                rx="24"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.5"
              />

              {/* Cabelo Feminino Estilizado (Franja lateral suave e volume no topo) */}
              <path
                d="M84 48 C81 30 90 14 112 14 C134 14 143 30 140 48 C136 36 126 30 114 29 C101 29 91 36 84 48 Z"
                fill="#111827"
              />
              {/* Mechas laterais emoldurando o rosto */}
              <path
                d="M87 38 C83 52 83 72 88 86 C86 72 87 54 91 40 Z"
                fill="#111827"
              />
              <path
                d="M137 38 C141 52 141 72 136 86 C138 72 137 54 133 40 Z"
                fill="#111827"
              />

              {/* Sobrancelhas Femininas Arqueadas */}
              <path
                d="M95 42 Q101 38 107 41.5"
                stroke="#111827"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <path
                d="M117 41.5 Q123 38 129 42"
                stroke="#111827"
                strokeWidth="2.1"
                strokeLinecap="round"
              />

              {/* Óculos Redondos */}
              <circle
                cx="101"
                cy="55"
                r="11.5"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              <circle
                cx="123"
                cy="55"
                r="11.5"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              {/* Ponte dos Óculos */}
              <path
                d="M112.5 54 Q112 52 111.5 54"
                stroke="#111827"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* Hastes laterais dos óculos */}
              <line
                x1="87"
                y1="54"
                x2="89.5"
                y2="54"
                stroke="#111827"
                strokeWidth="2.2"
              />
              <line
                x1="134.5"
                y1="54"
                x2="137"
                y2="54"
                stroke="#111827"
                strokeWidth="2.2"
              />

              {/* Olhos com Cílios Delicados */}
              <circle cx="101" cy="55" r="2.2" fill="#111827" />
              <path
                d="M98 53.5 L96 51.5"
                stroke="#111827"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="123" cy="55" r="2.2" fill="#111827" />
              <path
                d="M126 53.5 L128 51.5"
                stroke="#111827"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              {/* Nariz Delicado */}
              <path
                d="M112 58 L110.8 64.5 L113.2 65.5"
                stroke="#111827"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Sorriso Simpático */}
              <path
                d="M105 73.5 Q112 79.5 119 73.5"
                stroke="#111827"
                strokeWidth="2.3"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            /* ============================================================ */
            /* VERSÃO MASCULINA (Bonequinho original preservado)            */
            /* ============================================================ */
            <svg
              width="168"
              height="148"
              viewBox="0 0 180 155"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-36 h-32 sm:w-44 sm:h-36 block"
            >
              {/* Braço Esquerdo Acenando (Com animação suave de aceno) */}
              <motion.g
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 7, -4, 7, 0] }}
                transition={{
                  duration: 2.2,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 4,
                }}
                style={{ originX: "78px", originY: "135px" }}
              >
                {/* Antebraço e Mão Acenando */}
                <path
                  d="M74 146 L55 104 L43 84"
                  stroke="#111827"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M74 146 L55 104 L43 84"
                  stroke="#ffffff"
                  strokeWidth="7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Palma e Dedos da Mão */}
                <g transform="translate(22, 50)">
                  {/* Palma */}
                  <path
                    d="M14 28 C11 28 9 24 10 19 L12 13 C13 11 26 11 27 14 L29 22 C30 26 26 31 21 31 Z"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.3"
                    strokeLinejoin="round"
                  />
                  {/* Dedo Mínimo */}
                  <path
                    d="M11 19 L6 10 C5 8 8 6 9.5 8.5 L14 16"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Dedo Anelar */}
                  <path
                    d="M14 15 L11 4 C10.5 1.5 14 1 14.8 3.5 L17.5 14"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Dedo Médio */}
                  <path
                    d="M18 14 L18 2 C18 -0.5 21.5 -0.5 21.5 2 L21.5 14"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Dedo Indicador */}
                  <path
                    d="M22 15 L25 4.5 C25.8 2 29 3 28 5.5 L25 16"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Polegar */}
                  <path
                    d="M26 20 L33 15 C35 13.5 37 16.5 35 18.5 L28 25"
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Detalhe interno da palma */}
                  <path
                    d="M16 22 Q21 20 24 24"
                    stroke="#111827"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </g>
              </motion.g>

              {/* Braço Direito (descendo na lateral direita) */}
              <path
                d="M148 128 L153 155"
                stroke="#111827"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M148 128 L153 155"
                stroke="#ffffff"
                strokeWidth="8.5"
                strokeLinecap="round"
              />

              {/* Camiseta Preta / Tronco */}
              <path
                d="M72 128 C78 112 92 108 112 108 C132 108 145 113 151 128 L158 155 L64 155 Z"
                fill="#111827"
              />
              {/* Manga Esquerda da Camiseta */}
              <path
                d="M76 116 L59 132 L68 147 L84 134 Z"
                fill="#111827"
              />

              {/* Pescoço */}
              <path
                d="M104 86 L104 110 C104 115 120 115 120 110 L120 86 Z"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />

              {/* Orelha Esquerda */}
              <circle
                cx="85"
                cy="58"
                r="6"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              <path
                d="M84 56 C82.5 57 82.5 59.5 84.5 60"
                stroke="#111827"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              {/* Orelha Direita */}
              <circle
                cx="139"
                cy="58"
                r="6"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              <path
                d="M140 56 C141.5 57 141.5 59.5 139.5 60"
                stroke="#111827"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              {/* Rosto / Cabeça */}
              <rect
                x="87"
                y="26"
                width="50"
                height="65"
                rx="24"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.5"
              />

              {/* Cabelo Estilizado no Topo */}
              <path
                d="M86 42 C83 30 89 16 102 16 C106 10 118 9 125 14 C136 14 142 25 138 38 C132 33 121 31 111 32 C99 33 91 36 86 42 Z"
                fill="#111827"
              />

              {/* Sobrancelhas */}
              <path
                d="M95 43 Q101 39 107 42"
                stroke="#111827"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M117 42 Q123 39 129 43"
                stroke="#111827"
                strokeWidth="2.4"
                strokeLinecap="round"
              />

              {/* Óculos Redondos */}
              <circle
                cx="101"
                cy="55"
                r="11.5"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              <circle
                cx="123"
                cy="55"
                r="11.5"
                fill="#ffffff"
                stroke="#111827"
                strokeWidth="2.4"
              />
              {/* Ponte dos Óculos */}
              <path
                d="M112.5 54 Q112 52 111.5 54"
                stroke="#111827"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <line
                x1="112"
                y1="54"
                x2="112"
                y2="54"
                stroke="#111827"
                strokeWidth="2.4"
              />
              {/* Hastes laterais dos óculos */}
              <line
                x1="87"
                y1="54"
                x2="89.5"
                y2="54"
                stroke="#111827"
                strokeWidth="2.2"
              />
              <line
                x1="134.5"
                y1="54"
                x2="137"
                y2="54"
                stroke="#111827"
                strokeWidth="2.2"
              />

              {/* Olhos */}
              <circle cx="101" cy="55" r="2.2" fill="#111827" />
              <circle cx="123" cy="55" r="2.2" fill="#111827" />

              {/* Nariz */}
              <path
                d="M112 58 L110.5 65 L113.5 66"
                stroke="#111827"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Sorriso */}
              <path
                d="M105 74 Q112 79 119 73"
                stroke="#111827"
                strokeWidth="2.3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      </motion.div>
    </div>
  );
}
