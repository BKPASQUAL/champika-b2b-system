"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Save, Target, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount);

interface Profile {
  id: string;
  fullName: string;
  role: string;
}

interface TargetRecord {
  id: string;
  user_id: string;
  profiles: { full_name: string };
  target_type: string;
  time_category: string;
  target_amount: number;
  bonus_amount: number;
  is_active: boolean;
}

export default function TargetsSettingsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  
  const [userId, setUserId] = useState("");
  const [timeCategory, setTimeCategory] = useState("Monthly");
  const [targetType, setTargetType] = useState("Sales");
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.businessId) {
      setBusinessId(user.businessId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadData = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const [profilesRes, targetsRes] = await Promise.all([
        fetch(`/api/users`),
        fetch(`/api/targets?business_id=${businessId}`)
      ]);
      
      if (profilesRes.ok) {
        setProfiles(await profilesRes.json());
      }
      
      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data.targets || []);
      }
    } catch {
      toast.error("Failed to load targets data.");
    } finally {
      setIsLoading(false);
    }
  };

  // We only call API for users if we don't have them
  useEffect(() => {
    loadData();
  }, [businessId]);

  const handleSubmit = async () => {
    if (!userId) return toast.error("Please select a user");
    if (targetAmount <= 0) return toast.error("Please set a valid target amount");
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          target_type: targetType,
          time_category: timeCategory,
          target_amount: targetAmount,
          bonus_amount: bonusAmount,
          business_id: businessId
        })
      });
      
      if (res.ok) {
        toast.success("Target successfully configured.");
        setTargetAmount(0);
        setBonusAmount(0);
        loadData();
      } else {
        toast.error("Failed to configure target");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <Target className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Targets & Bonus Settings</h1>
          <p className="text-muted-foreground text-sm">Configure sales targets and corresponding bonuses for team members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Set User Target</CardTitle>
            <CardDescription>Assign a new goal to a sales representative</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                   {/* In a real scenario we use profiles map, since users api might differ, manually putting some placeholder if empty */}
                   {profiles.length > 0 ? (
                     profiles.filter(p => p.role === 'rep').map(p => (
                       <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                     ))
                   ) : (
                     <SelectItem value="placeholder" disabled>Loading users...</SelectItem>
                   )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Category</Label>
              <Select value={timeCategory} onValueChange={setTimeCategory}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Amount (LKR)</Label>
              <Input type="number" min="0" value={targetAmount || ""} onChange={(e) => setTargetAmount(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label>Target Bonus (LKR)</Label>
              <Input type="number" min="0" value={bonusAmount || ""} onChange={(e) => setBonusAmount(Number(e.target.value))} />
            </div>

            <Button onClick={handleSubmit} disabled={isSubmitting || !userId || targetAmount <= 0} className="w-full mt-4">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Target
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Active Settings</CardTitle>
            <CardDescription>Current targets actively tracked for users</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : targets.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No active targets configured yet.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Time Category</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Bonus</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.profiles?.full_name || 'Unknown'}</TableCell>
                        <TableCell>{t.time_category}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(t.target_amount)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(t.bonus_amount)}</TableCell>
                        <TableCell className="text-center">
                          {t.is_active ? <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" /> Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
