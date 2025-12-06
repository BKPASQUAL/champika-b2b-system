"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Loader2 } from "lucide-react";
import { OverviewStats } from "./_components/OverviewStats";
import { BusinessReportTable } from "./_components/BusinessReportTable";
// Replaced ProductReportTable with ProfitMarginTable
import { ProfitMarginTable } from "./_components/ProfitMarginTable";
import { CustomerReportTable } from "./_components/CustomerReportTable";
import { RepReportTable } from "./_components/RepReportTable";
import { OrderReportTable } from "./_components/OrderReportTable";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    overview: { revenue: 0, cost: 0, profit: 0, margin: 0 },
    products: [],
    customers: [],
    reps: [],
    orders: [],
    business: [],
  });

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      try {
        // Fetching data for current month (default API behavior)
        const res = await fetch("/api/reports");
        const json = await res.json();

        if (json.error) {
          console.error("API Error:", json.error);
        } else {
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch reports", error);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Calculating financial data...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Financial Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Profit margins, revenue, and performance analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            This Month
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="business">By Business</TabsTrigger>
          <TabsTrigger value="customers">By Customer</TabsTrigger>
          <TabsTrigger value="products">By Product</TabsTrigger>
          <TabsTrigger value="reps">By Representative</TabsTrigger>
          <TabsTrigger value="orders">By Order</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewStats stats={data.overview} />
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Business Unit Analysis</CardTitle>
              <CardDescription>
                Performance across business units.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessReportTable data={data.business} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
              <CardDescription>Profitability by product.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Used ProfitMarginTable here */}
              <ProfitMarginTable data={data.products} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Customer Analytics</CardTitle>
              <CardDescription>Top profitable customers.</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerReportTable data={data.customers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reps">
          <Card>
            <CardHeader>
              <CardTitle>Sales Representative Performance</CardTitle>
              <CardDescription>Sales volume by rep.</CardDescription>
            </CardHeader>
            <CardContent>
              <RepReportTable data={data.reps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order Profitability</CardTitle>
              <CardDescription>Margins per specific order.</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderReportTable data={data.orders} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
