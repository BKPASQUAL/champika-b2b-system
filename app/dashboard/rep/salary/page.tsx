"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  Utensils,
  Moon,
  Briefcase,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- MOCK DATA ---
const MOCK_SALARY_DATA = {
  month: "October 2023",
  workingDays: 24,
  nightOuts: 5,
  totalSalesNonOrange: 3250000, // 3.25M (Target Met)
  totalSalesOrange: 150000,
  commissionEarned: 42500.0,
  rates: {
    dailyBasic: 1200,
    lunchAllowance: 400,
    nightOutAllowance: 1500,
    targetThreshold: 3000000,
    targetBonus: 5000,
  },
  attendance: [
    { date: "2023-10-01", status: "Present", nightOut: false, sales: 150000 },
    { date: "2023-10-02", status: "Present", nightOut: true, sales: 210000 },
    { date: "2023-10-03", status: "Present", nightOut: false, sales: 90000 },
    { date: "2023-10-04", status: "Present", nightOut: false, sales: 120000 },
    { date: "2023-10-05", status: "Leave", nightOut: false, sales: 0 },
    // ... truncated for design
  ],
};

export default function RepSalaryPage() {
  const [selectedMonth, setSelectedMonth] = useState("oct-2023");
  const data = MOCK_SALARY_DATA;
  const rates = data.rates;

  // --- CALCULATIONS ---
  const basicSalary = data.workingDays * rates.dailyBasic;
  const lunchAllowances = data.workingDays * rates.lunchAllowance;
  const nightOutAllowances = data.nightOuts * rates.nightOutAllowance;
  
  const isTargetMet = data.totalSalesNonOrange >= rates.targetThreshold;
  const targetBonus = isTargetMet ? rates.targetBonus : 0;

  const totalEarnings =
    basicSalary +
    lunchAllowances +
    nightOutAllowances +
    data.commissionEarned +
    targetBonus;

  // Progress Bar Calculation
  const progressPercent = Math.min(
    (data.totalSalesNonOrange / rates.targetThreshold) * 100,
    100
  );

  return (
    <div className="space-y-6  mx-auto pb-10">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary & Performance</h1>
          <p className="text-muted-foreground">
            View your monthly earnings, allowances, and commission breakdown.
          </p>
        </div>
        <div className="w-[180px]">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oct-2023">October 2023</SelectItem>
              <SelectItem value="sep-2023">September 2023</SelectItem>
              <SelectItem value="aug-2023">August 2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              Total Earnings
            </CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {totalEarnings.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Final payout for {data.month}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {data.commissionEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From finalized orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Worked</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.workingDays} Days</div>
            <p className="text-xs text-muted-foreground mt-1">
              Includes {data.nightOuts} Night Outs
            </p>
          </CardContent>
        </Card>

        <Card className={cn(isTargetMet ? "bg-green-50 border-green-200" : "")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Target Bonus</CardTitle>
            <Trophy className={cn("h-4 w-4", isTargetMet ? "text-green-600" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", isTargetMet ? "text-green-700" : "")}>
              LKR {targetBonus.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isTargetMet ? "Target Achieved! 🎉" : "Keep pushing!"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Breakdown */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Salary Breakdown Card */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Breakdown</CardTitle>
              <CardDescription>Line items for your monthly payment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Salary */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Basic Salary</p>
                    <p className="text-xs text-muted-foreground">
                      {data.workingDays} Days × LKR {rates.dailyBasic}
                    </p>
                  </div>
                </div>
                <div className="font-semibold">
                  LKR {basicSalary.toLocaleString()}
                </div>
              </div>

              <Separator />

              {/* Lunch Allowance */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <Utensils className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Lunch Allowance</p>
                    <p className="text-xs text-muted-foreground">
                      {data.workingDays} Days × LKR {rates.lunchAllowance}
                    </p>
                  </div>
                </div>
                <div className="font-semibold">
                  LKR {lunchAllowances.toLocaleString()}
                </div>
              </div>

              <Separator />

              {/* Night Out Allowance */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Moon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Night Out Allowance</p>
                    <p className="text-xs text-muted-foreground">
                      {data.nightOuts} Nights × LKR {rates.nightOutAllowance}
                    </p>
                  </div>
                </div>
                <div className="font-semibold">
                  LKR {nightOutAllowances.toLocaleString()}
                </div>
              </div>

              <Separator />

              {/* Commissions */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Commission Earned</p>
                    <p className="text-xs text-muted-foreground">
                      Based on delivered orders
                    </p>
                  </div>
                </div>
                <div className="font-semibold">
                  LKR {data.commissionEarned.toLocaleString()}
                </div>
              </div>

              <Separator />

              {/* Target Bonus */}
              <div className="flex justify-between items-center bg-yellow-50/50 p-2 rounded-lg -mx-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-yellow-900">Monthly Target Bonus</p>
                    <p className="text-xs text-yellow-700">
                      Sales  3M (Excl. Orange)
                    </p>
                  </div>
                </div>
                <div className="font-bold text-yellow-900">
                  LKR {targetBonus.toLocaleString()}
                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-gray-50 border-t p-4 flex justify-between items-center">
              <span className="font-semibold text-gray-600">Total Net Salary</span>
              <span className="text-xl font-bold text-primary">
                LKR {totalEarnings.toLocaleString()}
              </span>
            </CardFooter>
          </Card>

          {/* Attendance History */}
           <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Night Out</TableHead>
                    <TableHead className="text-right">Daily Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance.map((record, i) => (
                    <TableRow key={i}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.nightOut ? (
                           <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">Yes</Badge>
                        ) : (
                           <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {record.sales.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Targets & Info */}
        <div className="space-y-6">
          
          {/* Target Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Sales Target</CardTitle>
              <CardDescription>Required for 5,000 Bonus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progressPercent.toFixed(1)}%</span>
                </div>
                {/* Custom Progress Bar using divs since component wasn't listed */}
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500", isTargetMet ? "bg-green-500" : "bg-primary")} 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex justify-between text-sm border-b pb-2">
                  <span className="text-muted-foreground">Current Sales</span>
                  <span className="font-semibold">LKR {(data.totalSalesNonOrange / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-2">
                  <span className="text-muted-foreground">Target Goal</span>
                  <span className="font-semibold">LKR {(rates.targetThreshold / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold text-red-500">
                    {isTargetMet 
                      ? "Target Reached!" 
                      : `LKR ${(rates.targetThreshold - data.totalSalesNonOrange).toLocaleString()}`}
                  </span>
                </div>
              </div>
              
              {!isTargetMet && (
                <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    You need <strong>LKR {(rates.targetThreshold - data.totalSalesNonOrange).toLocaleString()}</strong> more in sales (excluding Orange items) to unlock the LKR 5,000 bonus.
                  </p>
                </div>
              )}
               
               {isTargetMet && (
                <div className="bg-green-50 text-green-800 text-xs p-3 rounded flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Congratulations! You have unlocked the monthly performance bonus.
                  </p>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Rate Card Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compensation Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Wage</span>
                <span>LKR 1,200</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lunch Allowance</span>
                <span>LKR 400 / day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Night Out</span>
                <span>LKR 1,500 / night</span>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}