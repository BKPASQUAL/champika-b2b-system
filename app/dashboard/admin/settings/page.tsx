"use client";

import React, { useState } from "react";
import { CategorySettings } from "./_components/CategorySettings";
import { BusinessSettings } from "./_components/BusinessSettings";
import { LocationSettings } from "./_components/LocationSettings";
import { CommissionSettings } from "./_components/CommissionSettings";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Settings,
  Shield,
  Bell,
  Database,
  Percent,
  Briefcase,
  MapPin,
  Building2,
  Phone,
  Mail,
  FileText,
  Save,
  ChevronRight,
  Info,
} from "lucide-react";

// ── Navigation items ──────────────────────────────────────────────────────────
const navItems = [
  {
    id: "general",
    label: "General",
    icon: Settings,
    description: "Company info & preferences",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    gradient: "from-blue-600 to-blue-500",
  },
  {
    id: "categories",
    label: "Categories",
    icon: Database,
    description: "Products, brands, models & more",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    gradient: "from-violet-600 to-purple-500",
  },
  {
    id: "business",
    label: "Business",
    icon: Briefcase,
    description: "Business entities",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    gradient: "from-amber-600 to-orange-500",
  },
  {
    id: "locations",
    label: "Locations",
    icon: MapPin,
    description: "Warehouses & showrooms",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    gradient: "from-emerald-600 to-teal-500",
  },
  {
    id: "commissions",
    label: "Commissions",
    icon: Percent,
    description: "Supplier commission rules",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    gradient: "from-rose-600 to-pink-500",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Alert & email preferences",
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    gradient: "from-sky-600 to-cyan-500",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Password & access control",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    gradient: "from-slate-700 to-slate-600",
  },
] as const;

type SectionId = (typeof navItems)[number]["id"];

// ── General Section ───────────────────────────────────────────────────────────
function GeneralSettings() {
  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Company Information</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Details used across invoices, reports, and receipts
          </p>
        </div>
      </div>

      <Separator />

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name" className="text-sm font-semibold text-gray-700">
            Company Name
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="company-name"
              defaultValue="Champika Hardware"
              className="pl-9 h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100"
              placeholder="Your company name"
            />
          </div>
        </div>

        {/* BR Number */}
        <div className="space-y-2">
          <Label htmlFor="br-no" className="text-sm font-semibold text-gray-700">
            Business Reg. No (BR)
          </Label>
          <div className="relative">
            <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="br-no"
              defaultValue="PV-12345"
              className="pl-9 h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100"
              placeholder="PV-XXXXX"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">
            Contact Phone
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              defaultValue="077-1234567"
              className="pl-9 h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100"
              placeholder="077-XXXXXXX"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
            Support Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              defaultValue="support@champika.lk"
              className="pl-9 h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100"
              placeholder="email@company.com"
            />
          </div>
        </div>

        {/* Address */}
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="address" className="text-sm font-semibold text-gray-700">
            Business Address
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="address"
              defaultValue="No 45, Main Street, Galle"
              className="pl-9 h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100"
              placeholder="Street, City, Postal Code"
            />
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>These details appear on all printed invoices and system reports.</span>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Notifications Section ─────────────────────────────────────────────────────
function NotificationsSettings() {
  const items = [
    {
      id: "low-stock",
      title: "Low Stock Alerts",
      description: "Notify when products reach minimum stock level",
      defaultChecked: true,
    },
    {
      id: "new-order",
      title: "New Order Emails",
      description: "Receive an email for every new order placed",
      defaultChecked: true,
    },
    {
      id: "daily-report",
      title: "Daily Summary Report",
      description: "Get a daily sales & inventory digest each morning",
      defaultChecked: false,
    },
    {
      id: "payment-overdue",
      title: "Overdue Payment Alerts",
      description: "Notify when customer payments become overdue",
      defaultChecked: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-sky-600 to-cyan-500 flex items-center justify-center shadow-md shadow-sky-200">
          <Bell className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alert Preferences</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure how you receive system alerts and notifications
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50/70 transition-colors",
              idx % 2 === 0 ? "" : "bg-gray-50/50"
            )}
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-gray-800">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch defaultChecked={item.defaultChecked} />
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button className="gap-2 bg-sky-600 hover:bg-sky-700 shadow-sm shadow-sky-200">
          <Save className="h-4 w-4" />
          Save Preferences
        </Button>
      </div>
    </div>
  );
}

// ── Security Section ──────────────────────────────────────────────────────────
function SecuritySettings() {
  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-md shadow-slate-200">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Access Control</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your password and security settings
          </p>
        </div>
      </div>

      <Separator />

      <div className="max-w-md space-y-5">
        <div className="space-y-2">
          <Label htmlFor="curr-pw" className="text-sm font-semibold text-gray-700">
            Current Password
          </Label>
          <Input
            id="curr-pw"
            type="password"
            className="h-10 border-gray-200"
            placeholder="Enter current password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-pw" className="text-sm font-semibold text-gray-700">
            New Password
          </Label>
          <Input
            id="new-pw"
            type="password"
            className="h-10 border-gray-200"
            placeholder="Enter new password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pw" className="text-sm font-semibold text-gray-700">
            Confirm New Password
          </Label>
          <Input
            id="confirm-pw"
            type="password"
            className="h-10 border-gray-200"
            placeholder="Repeat new password"
          />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Use at least 8 characters, mixing letters, numbers, and symbols.</span>
        </div>

        <Button variant="destructive" className="gap-2 w-full sm:w-auto">
          <Shield className="h-4 w-4" />
          Update Password
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("general");

  const activeItem = navItems.find((n) => n.id === activeSection)!;

  const renderContent = () => {
    switch (activeSection) {
      case "general":       return <GeneralSettings />;
      case "categories":    return <CategorySettings />;
      case "business":      return <BusinessSettings />;
      case "locations":     return <LocationSettings />;
      case "commissions":   return <CommissionSettings />;
      case "notifications": return <NotificationsSettings />;
      case "security":      return <SecuritySettings />;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6 shadow-lg">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 left-20 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-inner">
            <Settings className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-sm text-slate-300 mt-0.5">
              Manage system preferences, categories, and configurations
            </p>
          </div>
        </div>
      </div>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex gap-6 items-start">
        {/* ── Left Sidebar Nav ── */}
        <nav className="w-64 shrink-0 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-3 border-b border-gray-100 bg-gray-50/70">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 px-2">
              Configuration
            </p>
          </div>
          <ul className="p-2 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
                      isActive
                        ? `${item.bgColor} ${item.color} font-semibold shadow-sm`
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {/* Icon box */}
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                        isActive
                          ? `bg-gradient-to-br ${item.gradient} text-white shadow-sm`
                          : "bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-tight truncate">{item.label}</p>
                      {!isActive && (
                        <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Active chevron */}
                    {isActive && (
                      <ChevronRight className={cn("h-4 w-4 shrink-0", item.color)} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Right Content Panel ── */}
        <div className="flex-1 min-w-0">
          {/* Content card with colored top-border accent */}
          <div
            className={cn(
              "rounded-2xl border bg-white shadow-sm overflow-hidden"
            )}
          >
            {/* Thin colored top accent bar */}
            <div className={`h-1 bg-gradient-to-r ${activeItem.gradient} w-full`} />

            {/* Breadcrumb trail */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <Settings className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">Settings</span>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <span className={cn("text-xs font-semibold", activeItem.color)}>
                {activeItem.label}
              </span>
            </div>

            {/* Section Content */}
            <div className="p-6 md:p-8">{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
