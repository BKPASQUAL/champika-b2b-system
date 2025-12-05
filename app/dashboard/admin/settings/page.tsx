"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategorySettings } from "./_components/CategorySettings";
import { BusinessSettings } from "./_components/BusinessSettings";
import { LocationSettings } from "./_components/LocationSettings"; // ✅ Import new component
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Shield,
  Bell,
  Database,
  Percent,
  Briefcase,
  MapPin,
} from "lucide-react"; // ✅ Import MapPin
import { CommissionSettings } from "./_components/CommissionSettings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage system preferences and configurations
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        {/* Updated Grid Columns to 7 */}
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 h-auto">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Business
          </TabsTrigger>

          {/* ✅ NEW LOCATIONS TAB */}
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Locations
          </TabsTrigger>

          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <Percent className="h-4 w-4" /> Commissions
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* 1. General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Details used for invoices and reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="Champika Hardware" />
                </div>
                <div className="space-y-2">
                  <Label>Business Reg No (BR)</Label>
                  <Input defaultValue="PV-12345" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input defaultValue="077-1234567" />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input defaultValue="support@champika.lk" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Address</Label>
                  <Input defaultValue="No 45, Main Street, Galle" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Categories Settings */}
        <TabsContent value="categories">
          <div className="max-full">
            <CategorySettings />
          </div>
        </TabsContent>

        {/* 3. Business Settings */}
        <TabsContent value="business">
          <div className="max-w-6xl">
            <BusinessSettings />
          </div>
        </TabsContent>

        {/* 4. ✅ Locations Settings Content */}
        <TabsContent value="locations">
          <div className="max-w-6xl">
            <LocationSettings />
          </div>
        </TabsContent>

        {/* 5. Commissions Settings */}
        <TabsContent value="commissions">
          <div className="max-w-6xl">
            <CommissionSettings />
          </div>
        </TabsContent>

        {/* 6. Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Alert Preferences</CardTitle>
              <CardDescription>
                Configure how you receive system alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when products reach min stock level
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">New Order Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email for every new order placed
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>
                Manage system security settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" />
              </div>
              <div className="flex justify-end">
                <Button variant="destructive">Update Password</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
