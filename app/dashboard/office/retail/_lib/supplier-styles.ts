// Supplier names and colours shared by the retail invoice screens (walk-in sale, invoice edit)

export const FIXED_SUPPLIERS = [
  { id: "orange-orel", name: "Orange (Orel Corporation)" },
  { id: "sierra-cables", name: "Sierra Cables" },
  { id: "wireman", name: "Wireman" }
];

export const getSupplierCleanName = (name?: string | null) => {
  if (!name) return "General";
  const s = name.toLowerCase();
  if (s.includes("sierra")) return "Sierra Cables";
  if (s.includes("wireman")) return "Wireman";
  if (s.includes("orange")) return "Orange";
  if (s.includes("chint")) return "Chint";
  if (s.includes("kelani")) return "Kelani";
  if (s.includes("acl")) return "ACL";
  if (s.includes("polycrome") || s.includes("polycreme")) return "Polycrome";
  return name;
};

export const getSupplierColorStyles = (supplier?: string | null) => {
  if (!supplier) {
    return {
      dot: "⚪",
      bgActive: "bg-slate-800 hover:bg-slate-900 text-white border-slate-800 shadow-sm",
      borderInactive: "border-slate-200 text-slate-700 hover:bg-slate-50",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      borderLeft: "border-l-slate-300",
      hoverBg: "hover:bg-slate-50",
    };
  }
  const s = supplier.toLowerCase();
  if (s.includes("sierra")) {
    return {
      dot: "🟣",
      bgActive: "bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm",
      borderInactive: "border-purple-200 text-purple-700 hover:bg-purple-50",
      badge: "bg-purple-100 text-purple-700 border-purple-200",
      borderLeft: "border-l-purple-500",
      hoverBg: "hover:bg-purple-50/50",
    };
  }
  if (s.includes("wireman")) {
    return {
      dot: "🔴",
      bgActive: "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm",
      borderInactive: "border-red-200 text-red-700 hover:bg-red-50",
      badge: "bg-red-100 text-red-700 border-red-200",
      borderLeft: "border-l-red-500",
      hoverBg: "hover:bg-red-50/50",
    };
  }
  if (s.includes("orange")) {
    return {
      dot: "🟠",
      bgActive: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-sm",
      borderInactive: "border-orange-200 text-orange-700 hover:bg-orange-50",
      badge: "bg-orange-100 text-orange-700 border-orange-200",
      borderLeft: "border-l-orange-500",
      hoverBg: "hover:bg-orange-50/50",
    };
  }
  if (s.includes("chint")) {
    return {
      dot: "🔵",
      bgActive: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm",
      borderInactive: "border-blue-200 text-blue-700 hover:bg-blue-50",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      borderLeft: "border-l-blue-500",
      hoverBg: "hover:bg-blue-50/50",
    };
  }
  if (s.includes("kelani")) {
    return {
      dot: "🟢",
      bgActive: "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-sm",
      borderInactive: "border-green-200 text-green-700 hover:bg-green-50",
      badge: "bg-green-100 text-green-700 border-green-200",
      borderLeft: "border-l-green-500",
      hoverBg: "hover:bg-green-50/50",
    };
  }
  if (s.includes("acl")) {
    return {
      dot: "🟡",
      bgActive: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm",
      borderInactive: "border-amber-200 text-amber-700 hover:bg-amber-50",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      borderLeft: "border-l-amber-500",
      hoverBg: "hover:bg-amber-50/50",
    };
  }
  if (s.includes("polycrome") || s.includes("polycreme")) {
    return {
      dot: "🟤",
      bgActive: "bg-amber-800 hover:bg-amber-900 text-white border-amber-800 shadow-sm",
      borderInactive: "border-amber-200 text-amber-850 hover:bg-amber-50",
      badge: "bg-amber-100 text-amber-850 border-amber-200",
      borderLeft: "border-l-amber-700",
      hoverBg: "hover:bg-amber-50/50",
    };
  }
  return {
    dot: "⚪",
    bgActive: "bg-slate-800 hover:bg-slate-900 text-white border-slate-800 shadow-sm",
    borderInactive: "border-slate-200 text-slate-700 hover:bg-slate-50",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    borderLeft: "border-l-slate-300",
    hoverBg: "hover:bg-slate-50",
  };
};
