const ACTIVO_CATEGORY_OPTIONS = [
  {
    value: "Equipo de trabajo",
    shortLabel: "Trabajo",
    tone: "neutral",
    aliases: ["computo", "pc", "portatil", "desktop"]
  },
  {
    value: "Impresora / Escaner",
    shortLabel: "Impresion",
    tone: "warning",
    aliases: ["impresion", "scanner", "escaner", "multifuncional"]
  },
  {
    value: "Infraestructura",
    shortLabel: "Infra",
    tone: "danger",
    aliases: ["red", "networking", "switch", "ap", "rack"]
  },
  {
    value: "Telefono",
    shortLabel: "Telefonia",
    tone: "success",
    aliases: ["telefonia", "celular", "voip"]
  }
];

const EQUIPO_OPTIONS_BY_CATEGORY = {
  "Equipo de trabajo": [
    "Laptop",
    "Desktop",
    "All In One",
    "Thin Client",
    "Tablet",
    "Workstation",
    "Monitor",
    "Otro equipo de trabajo"
  ],
  "Impresora / Escaner": [
    "Impresora",
    "Escaner",
    "Multifuncional",
    "Plotter",
    "Impresora termica",
    "Otro impresora / escaner"
  ],
  Infraestructura: [
    "Switch",
    "Access Point",
    "Rack",
    "Router",
    "Firewall",
    "Patch Panel",
    "Servidor",
    "UPS",
    "Camara",
    "Otro infraestructura"
  ],
  Telefono: [
    "Telefono IP",
    "Telefono analogico",
    "Celular corporativo",
    "Diadema",
    "Radio",
    "Otro telefono"
  ]
};

const CATEGORY_SUMMARY_KEYS = {
  "Equipo de trabajo": "trabajo",
  "Impresora / Escaner": "impresion",
  Infraestructura: "infraestructura",
  Telefono: "telefonia"
};

const CATEGORY_EXTRA_FIELDS = {
  "Impresora / Escaner": [
    { key: "ip", label: "IP / Hostname", placeholder: "Ej: 192.168.1.50" },
    { key: "conectividad", label: "Conectividad", placeholder: "USB / Ethernet / WiFi" },
    { key: "tecnologia", label: "Tecnologia", placeholder: "Laser / Tinta / Termica" },
    { key: "contador", label: "Contador de impresiones", placeholder: "Ej: 12000" }
  ],
  Infraestructura: [
    { key: "ip", label: "IP / Gestion", placeholder: "IP de gestion" },
    { key: "mac", label: "MAC", placeholder: "MAC del equipo" },
    { key: "rack", label: "Rack / Ubicacion", placeholder: "Rack, cuarto o piso" },
    { key: "puerto", label: "Puerto / VLAN", placeholder: "Puerto, VLAN, patch" }
  ],
  Telefono: [
    { key: "extension", label: "Extension", placeholder: "Ej: 1234" },
    { key: "numero_linea", label: "Numero de linea", placeholder: "Linea o SIM" },
    { key: "imei", label: "IMEI", placeholder: "IMEI del equipo" },
    { key: "mac", label: "MAC", placeholder: "MAC del dispositivo" }
  ]
};

const normalizeSearchValue = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const normalizeImportKey = (value = "") => normalizeSearchValue(value).replace(/[^a-z0-9]/g, "");

const getNormalizedWordSet = (...values) => {
  return new Set(
    values
      .map((item) => normalizeSearchValue(item))
      .join(" ")
      .split(/[^a-z0-9]+/g)
      .filter(Boolean)
  );
};

const hasAnyNormalizedPhrase = (source = "", phrases = []) => {
  const normalizedSource = normalizeSearchValue(source);
  return (Array.isArray(phrases) ? phrases : []).some((phrase) =>
    normalizedSource.includes(normalizeSearchValue(phrase))
  );
};

const hasAnyNormalizedToken = (tokenSet, tokens = []) => {
  return (Array.isArray(tokens) ? tokens : []).some((token) =>
    tokenSet.has(normalizeImportKey(token))
  );
};

const normalizeCategoriaActivo = (value = "") => {
  const normalizedValue = normalizeSearchValue(value);
  if (!normalizedValue) return "";

  const matched = ACTIVO_CATEGORY_OPTIONS.find((option) => {
    if (normalizeSearchValue(option.value) === normalizedValue) {
      return true;
    }
    return option.aliases.some((alias) => normalizeSearchValue(alias) === normalizedValue);
  });

  return matched?.value || "";
};

const inferCategoriaActivo = (item = {}) => {
  const explicitCategory = normalizeCategoriaActivo(
    item.categoria_activo ?? item.categoriaActivo ?? item.categoria ?? ""
  );
  if (explicitCategory) return explicitCategory;

  const sourceText = [
    item.equipo,
    item.nombre,
    item.activo,
    item.marca,
    item.modelo
  ].filter(Boolean).join(" ");
  const tokenSet = getNormalizedWordSet(sourceText);

  if (
    hasAnyNormalizedPhrase(sourceText, ["impresora", "escaner", "scanner", "multifuncional", "plotter"]) ||
    hasAnyNormalizedToken(tokenSet, ["impresora", "escaner", "scanner", "multifuncional", "plotter"])
  ) {
    return "Impresora / Escaner";
  }

  if (
    hasAnyNormalizedPhrase(sourceText, ["access point", "patch panel", "rack", "switch", "router", "firewall", "servidor"]) ||
    hasAnyNormalizedToken(tokenSet, ["ap", "rack", "switch", "router", "firewall", "patch", "servidor", "server", "ups", "ont", "modem", "nvr", "dvr"])
  ) {
    return "Infraestructura";
  }

  if (
    hasAnyNormalizedPhrase(sourceText, ["telefono ip", "telefono analogico", "celular", "movil", "diadema", "voip", "telefono"]) ||
    hasAnyNormalizedToken(tokenSet, ["telefono", "celular", "movil", "diadema", "voip", "handset"])
  ) {
    return "Telefono";
  }

  if (
    hasAnyNormalizedPhrase(sourceText, ["laptop", "portatil", "desktop", "all in one", "thin client", "tablet", "workstation"]) ||
    hasAnyNormalizedToken(tokenSet, ["laptop", "portatil", "desktop", "tablet", "workstation", "pc"])
  ) {
    return "Equipo de trabajo";
  }

  if (item.os || item.tipoRam || item.ram || item.tipoDisco || item.hdd || item.procesador) {
    return "Equipo de trabajo";
  }

  return "Equipo de trabajo";
};

const getCategoriaProfile = (categoria = "") => {
  const normalizedCategory = normalizeCategoriaActivo(categoria);
  const extraFields = CATEGORY_EXTRA_FIELDS[normalizedCategory] || [];

  switch (normalizedCategory) {
    case "Impresora / Escaner":
      return {
        description: "Usa esta categoria para impresoras, multifuncionales y escaneres.",
        requiredFields: ["categoria_activo", "entidad_id", "areaPrincipal", "equipo", "marca", "modelo", "serial"],
        showsComputeFields: false,
        extraFields
      };
    case "Infraestructura":
      return {
        description: "Usa esta categoria para switch, access point, rack, router y demas activos de red.",
        requiredFields: ["categoria_activo", "entidad_id", "areaPrincipal", "equipo", "marca", "modelo", "serial"],
        showsComputeFields: false,
        extraFields
      };
    case "Telefono":
      return {
        description: "Usa esta categoria para telefonia IP, moviles corporativos y diademas.",
        requiredFields: ["categoria_activo", "entidad_id", "areaPrincipal", "equipo", "marca", "modelo", "serial"],
        showsComputeFields: false,
        extraFields
      };
    default:
      return {
        description: "Usa esta categoria para computadores, portatiles y equipos de usuario final.",
        requiredFields: ["categoria_activo", "entidad_id", "areaPrincipal", "equipo", "marca", "modelo"],
        showsComputeFields: true,
        extraFields
      };
  }
};

export {
  ACTIVO_CATEGORY_OPTIONS,
  CATEGORY_SUMMARY_KEYS,
  EQUIPO_OPTIONS_BY_CATEGORY,
  getCategoriaProfile,
  inferCategoriaActivo,
  normalizeCategoriaActivo
};
