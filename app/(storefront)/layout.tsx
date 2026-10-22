"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingCart,
  FileSpreadsheet,
  Truck,
  Phone,
  Search,
  Menu,
  X,
  User,
  Zap,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useStorefrontCart } from "@/hooks/useStorefrontCart";
import { AuthModal } from "@/components/storefront/AuthModal";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { cart, cartCount, cartTotal, removeFromCart, updateQuantity } = useStorefrontCart();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check auth status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    toast.info("Signed out successfully");
  };

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Announcement Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>⚡ Islandwide Delivery on Quality House Wire, Switches & Breakers</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-amber-400" />
              Hotline: 0777681663 / 077-3151561
            </span>
            <Link href="/track" className="hover:text-white transition-colors flex items-center gap-1">
              <Truck className="w-3 h-3 text-emerald-400" />
              Track Delivery
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 leading-none">
                BK <span className="text-amber-600">WIRING</span> KADE
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-600 tracking-wider uppercase mt-0.5">
                Electrical &amp; Wiring Store
              </div>
            </div>
          </Link>

          {/* Desktop Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md relative">
            <Input
              type="text"
              placeholder="Search home cables (1.0mm, 2.5mm), switches, sockets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-10 pr-4 bg-slate-50 border-slate-200 rounded-full focus-visible:ring-amber-500 text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </form>

          {/* Nav Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Project Quote Generator Link */}
            <Link href="/quotation-builder" className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Build Project BOQ / Quote
            </Link>

            {/* Track Order Link */}
            <Link href="/track" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors">
              <Truck className="w-4 h-4 text-slate-500" />
              Track Order
            </Link>

            {/* Cart Drawer Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative h-10 px-3.5 rounded-xl border-slate-200 hover:bg-slate-50 gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline font-bold text-xs text-slate-800">Cart</span>
                  {cartCount > 0 && (
                    <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black animate-scale-in">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col p-6">
                <SheetHeader className="border-b pb-4">
                  <SheetTitle className="text-lg font-bold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-amber-600" />
                    Shopping Cart ({cartCount})
                  </SheetTitle>
                </SheetHeader>

                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <ShoppingCart className="w-8 h-8" />
                    </div>
                    <div className="font-bold text-slate-800">Your cart is empty</div>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Browse our high-quality wiring cables, modular switches, and electrical accessories.
                    </p>
                    <Button onClick={() => router.push("/products")} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                      Browse Products
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto py-4 space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-slate-900 truncate">{item.title}</h4>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              LKR {fmt(item.price)} / {item.unit}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-6 h-6 rounded bg-white border flex items-center justify-center text-xs font-bold hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold text-slate-800">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-6 h-6 rounded bg-white border flex items-center justify-center text-xs font-bold hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-extrabold text-slate-900">
                              LKR {fmt(item.price * item.quantity)}
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-[11px] text-rose-500 hover:underline mt-2 inline-block"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">Subtotal</span>
                        <span className="font-extrabold text-base text-slate-900">LKR {fmt(cartTotal)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Delivery calculated at checkout.</p>
                      <Button
                        onClick={() => router.push("/checkout")}
                        className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/20"
                      >
                        Proceed to Checkout
                      </Button>
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>

            {/* Auth / Profile Button */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link href="/my-orders">
                  <Button variant="ghost" size="sm" className="h-10 text-xs font-bold text-slate-700 gap-1.5">
                    <User className="w-4 h-4 text-amber-600" />
                    <span className="hidden sm:inline">{currentUser.email?.split("@")[0]}</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                  <LogOut className="w-4 h-4 text-slate-400 hover:text-slate-700" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="h-10 text-xs font-bold border-slate-200 hover:bg-slate-50 gap-1.5"
              >
                <User className="w-4 h-4 text-slate-600" />
                <span>Sign In</span>
              </Button>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b px-4 py-4 space-y-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Input
                type="text"
                placeholder="Search wiring, cables, switches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-4 text-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </form>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/products"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-sm font-bold text-slate-800 hover:bg-slate-50 rounded-lg flex items-center justify-between"
              >
                <span>📦 Product Catalog</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                href="/quotation-builder"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-lg flex items-center justify-between"
              >
                <span>📋 Build Project Quote / BOQ</span>
                <ChevronRight className="w-4 h-4 text-emerald-500" />
              </Link>
              <Link
                href="/track"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-sm font-bold text-slate-800 hover:bg-slate-50 rounded-lg flex items-center justify-between"
              >
                <span>🚚 Track Order</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content */}
      <main className="flex-1">{children}</main>

      {/* Clean Footer (No Boossa, No Champika Hardware) */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 text-xs py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <div className="text-lg font-black text-white tracking-tight">BK WIRING KADE</div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Specialized electrical and wiring supplies for homes, buildings, and projects. Premium home wiring cables, modular switches, sockets, and circuit breakers.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-3 text-sm">Product Categories</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/products?category=cables" className="hover:text-white transition-colors">House Wiring Cables (1.0mm, 2.5mm, 4.0mm)</Link></li>
              <li><Link href="/products?category=switches" className="hover:text-white transition-colors">Modular Switches &amp; Gang Plates</Link></li>
              <li><Link href="/products?category=breakers" className="hover:text-white transition-colors">MCB Breakers &amp; Distribution Boards</Link></li>
              <li><Link href="/products?category=conduit" className="hover:text-white transition-colors">Conduit Pipes, Bends &amp; Switch Boxes</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-3 text-sm">Customer Services</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/quotation-builder" className="hover:text-white transition-colors">Instant Project Quotation (PDF)</Link></li>
              <li><Link href="/track" className="hover:text-white transition-colors">Track Delivery Status</Link></li>
              <li><Link href="/checkout" className="hover:text-white transition-colors">Cash on Delivery &amp; Bank Transfer</Link></li>
              <li><Link href="/my-orders" className="hover:text-white transition-colors">My Past Orders</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-3 text-sm">Direct Customer Support</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Need technical advice or bulk wireman pricing for your project? Contact our electrical support desk:
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="text-white font-bold flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500" /> 0777681663 / 077-3151561
              </div>
              <div className="text-slate-400">Available Monday &ndash; Saturday, 8:00 AM &ndash; 6:00 PM</div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-slate-800/80 mt-10 pt-6 text-center text-slate-400 text-[11px]">
          &copy; {new Date().getFullYear()} BK WIRING KADE &bull; Electrical &amp; Wiring Supplies. All rights reserved.
        </div>
      </footer>

      {/* Auth Modal for Checkout Gating */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          toast.success("Signed in successfully!");
        }}
      />
    </div>
  );
}
