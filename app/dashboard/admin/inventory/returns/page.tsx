"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function ReturnsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    product_id: "",
    location_id: "",
    quantity: "",
    return_type: "Good", // Good or Damage
    reason: "",
    customer_id: null, // Optional logic to fetch customers can be added
  });

  // Fetch Data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch History
      const resReturns = await fetch("/api/inventory/returns");
      const returnsData = await resReturns.json();
      setReturns(returnsData);

      // Fetch Products (You might want to create a specific lightweight endpoint for dropdowns)
      const resProducts = await fetch("/api/products");
      const prodData = await resProducts.json();
      setProducts(prodData); // Assuming API returns { products: [] } or just []

      // Fetch Locations
      const resLocations = await fetch("/api/settings/locations");
      const locData = await resLocations.json();
      setLocations(locData);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.product_id || !formData.location_id || !formData.quantity) {
      toast.error("Please fill required fields");
      return;
    }

    // Find business ID from location (Assuming location object has business_id or we pick from current user context)
    const selectedLoc: any = locations.find(
      (l: any) => l.id === formData.location_id
    );
    const business_id = selectedLoc?.business_id;

    if (!business_id) {
      toast.error("Invalid Location configuration");
      return;
    }

    try {
      const res = await fetch("/api/inventory/returns", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          business_id,
        }),
      });

      if (!res.ok) throw new Error("Failed to process return");

      toast.success("Return processed successfully");
      setIsDialogOpen(false);
      setFormData({
        product_id: "",
        location_id: "",
        quantity: "",
        return_type: "Good",
        reason: "",
        customer_id: null,
      });
      fetchData(); // Refresh table
    } catch (error) {
      toast.error("Error saving return");
    }
  };

  // Filter
  const filteredReturns = Array.isArray(returns)
    ? returns.filter(
        (r: any) =>
          r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.products?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              Returns Management
            </h1>
          </div>
          <p className="text-muted-foreground ml-10">
            Process customer returns and manage damaged inventory.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Undo2 className="mr-2 h-4 w-4" /> Process Return
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Return</DialogTitle>
              <DialogDescription>
                This will update the stock levels based on the return type.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Return Type</Label>
                  <Select
                    value={formData.return_type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, return_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">
                        <div className="flex items-center text-green-600">
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Good Stock
                        </div>
                      </SelectItem>
                      <SelectItem value="Damage">
                        <div className="flex items-center text-red-600">
                          <AlertTriangle className="mr-2 h-4 w-4" /> Damaged
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(v) =>
                    setFormData({ ...formData, product_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.isArray(products) &&
                      products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Return Location</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(v) =>
                    setFormData({ ...formData, location_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse/shop..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(locations) &&
                      locations.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reason / Notes</Label>
                <Textarea
                  placeholder="Why is this being returned?"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Process Return</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Returns History</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search returns..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReturns.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.return_number}</TableCell>
                  <TableCell>
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.products?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.products?.sku}
                    </div>
                  </TableCell>
                  <TableCell>{r.locations?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.return_type === "Good" ? "secondary" : "destructive"
                      }
                    >
                      {r.return_type === "Good" ? "Stock Return" : "Damaged"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {r.quantity}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {r.reason}
                  </TableCell>
                </TableRow>
              ))}
              {filteredReturns.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No returns found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
