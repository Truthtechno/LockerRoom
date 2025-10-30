import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Palette, CreditCard, Upload, Image as ImageIcon, Phone, Mail, Globe, MapPin, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

type SystemBranding = {
  name?: string;
  logoUrl?: string;
  faviconUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyCountry?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
};

type SystemAppearance = {
  themeMode?: string;
  lightModePrimaryColor?: string;
  lightModeSecondaryColor?: string;
  lightModeAccentColor?: string;
  lightModeBackground?: string;
  lightModeForeground?: string;
  lightModeMuted?: string;
  lightModeBorder?: string;
  darkModePrimaryColor?: string;
  darkModeSecondaryColor?: string;
  darkModeAccentColor?: string;
  darkModeBackground?: string;
  darkModeForeground?: string;
  darkModeMuted?: string;
  darkModeBorder?: string;
  fontFamily?: string;
  fontSizeBase?: string;
};

type SystemPayment = {
  mockModeEnabled?: boolean;
  provider?: string;
  stripePublishableKey?: string;
  stripeSecretKeyEncrypted?: string;
  stripeWebhookSecretEncrypted?: string;
  paypalClientId?: string;
  paypalClientSecretEncrypted?: string;
  paypalMode?: string;
  currency?: string;
  xenScoutPriceCents?: number;
  enableSubscriptions?: boolean;
  subscriptionMonthlyPriceCents?: number;
  subscriptionYearlyPriceCents?: number;
};

export default function SystemConfig() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("branding");
  const [previewColors, setPreviewColors] = useState<any>({});

  // Fetch branding configuration
  const { data: branding, isLoading: brandingLoading } = useQuery<SystemBranding>({
    queryKey: ["/api/admin/system-config/branding"],
  });

  // Fetch appearance configuration
  const { data: appearance, isLoading: appearanceLoading } = useQuery<SystemAppearance>({
    queryKey: ["/api/admin/system-config/appearance"],
  });

  // Fetch payment configuration
  const { data: payment, isLoading: paymentLoading } = useQuery<SystemPayment>({
    queryKey: ["/api/admin/system-config/payment"],
  });

  // Branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (data: SystemBranding) => {
      return apiRequest("/api/admin/system-config/branding", {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config/branding"] });
      toast({
        title: "Branding Updated",
        description: "System branding has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update branding.",
        variant: "destructive",
      });
    },
  });

  // Appearance mutation
  const updateAppearanceMutation = useMutation({
    mutationFn: async (data: SystemAppearance) => {
      return apiRequest("/api/admin/system-config/appearance", {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config/appearance"] });
      toast({
        title: "Appearance Updated",
        description: "System appearance has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update appearance.",
        variant: "destructive",
      });
    },
  });

  // Payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: SystemPayment) => {
      return apiRequest("/api/admin/system-config/payment", {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config/payment"] });
      toast({
        title: "Payment Settings Updated",
        description: "Payment settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment settings.",
        variant: "destructive",
      });
    },
  });

  const handleBrandingUpdate = (field: string, value: string) => {
    updateBrandingMutation.mutate({
      ...branding,
      [field]: value,
    });
  };

  const handleAppearanceUpdate = (field: string, value: string) => {
    updateAppearanceMutation.mutate({
      ...appearance,
      [field]: value,
    });
  };

  const handlePaymentUpdate = (field: string, value: any) => {
    updatePaymentMutation.mutate({
      ...payment,
      [field]: value,
    });
  };

  if (brandingLoading || appearanceLoading || paymentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Header */}
        <div className="bg-card border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">System Configuration</h1>
                  <p className="text-sm text-muted-foreground mt-1">Configure branding, appearance, and payment settings</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment
            </TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Identity</CardTitle>
                <CardDescription>Configure your platform's brand identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Platform Name</Label>
                    <Input
                      id="name"
                      value={branding?.name || ""}
                      onChange={(e) => handleBrandingUpdate("name", e.target.value)}
                      placeholder="LockerRoom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={branding?.logoUrl || ""}
                      onChange={(e) => handleBrandingUpdate("logoUrl", e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faviconUrl">Favicon URL</Label>
                    <Input
                      id="faviconUrl"
                      value={branding?.faviconUrl || ""}
                      onChange={(e) => handleBrandingUpdate("faviconUrl", e.target.value)}
                      placeholder="https://example.com/favicon.ico"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Set up your company's contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={branding?.companyName || ""}
                      onChange={(e) => handleBrandingUpdate("companyName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Address</Label>
                    <Input
                      id="companyAddress"
                      value={branding?.companyAddress || ""}
                      onChange={(e) => handleBrandingUpdate("companyAddress", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyCity">City</Label>
                    <Input
                      id="companyCity"
                      value={branding?.companyCity || ""}
                      onChange={(e) => handleBrandingUpdate("companyCity", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyState">State/Province</Label>
                    <Input
                      id="companyState"
                      value={branding?.companyState || ""}
                      onChange={(e) => handleBrandingUpdate("companyState", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyZip">ZIP/Postal Code</Label>
                    <Input
                      id="companyZip"
                      value={branding?.companyZip || ""}
                      onChange={(e) => handleBrandingUpdate("companyZip", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyCountry">Country</Label>
                    <Input
                      id="companyCountry"
                      value={branding?.companyCountry || ""}
                      onChange={(e) => handleBrandingUpdate("companyCountry", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Configure contact details for your platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={branding?.contactEmail || ""}
                      onChange={(e) => handleBrandingUpdate("contactEmail", e.target.value)}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={branding?.contactPhone || ""}
                      onChange={(e) => handleBrandingUpdate("contactPhone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      value={branding?.websiteUrl || ""}
                      onChange={(e) => handleBrandingUpdate("websiteUrl", e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media</CardTitle>
                <CardDescription>Connect your social media accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="socialFacebook">Facebook</Label>
                    <Input
                      id="socialFacebook"
                      value={branding?.socialFacebook || ""}
                      onChange={(e) => handleBrandingUpdate("socialFacebook", e.target.value)}
                      placeholder="https://facebook.com/yourpage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialTwitter">Twitter</Label>
                    <Input
                      id="socialTwitter"
                      value={branding?.socialTwitter || ""}
                      onChange={(e) => handleBrandingUpdate("socialTwitter", e.target.value)}
                      placeholder="https://twitter.com/yourhandle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialInstagram">Instagram</Label>
                    <Input
                      id="socialInstagram"
                      value={branding?.socialInstagram || ""}
                      onChange={(e) => handleBrandingUpdate("socialInstagram", e.target.value)}
                      placeholder="https://instagram.com/yourhandle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialLinkedin">LinkedIn</Label>
                    <Input
                      id="socialLinkedin"
                      value={branding?.socialLinkedin || ""}
                      onChange={(e) => handleBrandingUpdate("socialLinkedin", e.target.value)}
                      placeholder="https://linkedin.com/company/yourcompany"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme Mode</CardTitle>
                <CardDescription>Configure default theme settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="themeMode">Theme Mode</Label>
                  <Select
                    value={appearance?.themeMode || "auto"}
                    onValueChange={(value) => handleAppearanceUpdate("themeMode", value)}
                  >
                    <SelectTrigger id="themeMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (System Default)</SelectItem>
                      <SelectItem value="light">Light Mode</SelectItem>
                      <SelectItem value="dark">Dark Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Light Mode Colors</CardTitle>
                <CardDescription>Configure light mode color scheme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("lightModePrimaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("lightModePrimaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModeSecondaryColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("lightModeSecondaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModeSecondaryColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("lightModeSecondaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModeAccentColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeAccentColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModeAccentColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeAccentColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModeBackground || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeBackground", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModeBackground || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeBackground", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dark Mode Colors</CardTitle>
                <CardDescription>Configure dark mode color scheme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("darkModePrimaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("darkModePrimaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModeSecondaryColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("darkModeSecondaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModeSecondaryColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("darkModeSecondaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModeAccentColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("darkModeAccentColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModeAccentColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("darkModeAccentColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModeBackground || "#0A0A0A"}
                        onChange={(e) => handleAppearanceUpdate("darkModeBackground", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModeBackground || "#0A0A0A"}
                        onChange={(e) => handleAppearanceUpdate("darkModeBackground", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>Configure font settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fontFamily">Font Family</Label>
                    <Input
                      id="fontFamily"
                      value={appearance?.fontFamily || "Inter"}
                      onChange={(e) => handleAppearanceUpdate("fontFamily", e.target.value)}
                      placeholder="Inter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fontSizeBase">Base Font Size</Label>
                    <Input
                      id="fontSizeBase"
                      value={appearance?.fontSizeBase || "1rem"}
                      onChange={(e) => handleAppearanceUpdate("fontSizeBase", e.target.value)}
                      placeholder="1rem"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment providers and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mockMode">Mock Payment Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable mock payments for development and testing</p>
                  </div>
                  <Switch
                    id="mockMode"
                    checked={payment?.mockModeEnabled !== false}
                    onCheckedChange={(checked) => handlePaymentUpdate("mockModeEnabled", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider">Payment Provider</Label>
                  <Select
                    value={payment?.provider || "none"}
                    onValueChange={(value) => handlePaymentUpdate("provider", value)}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {payment?.provider === "stripe" && (
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Configuration</CardTitle>
                  <CardDescription>Configure your Stripe payment integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripePublishableKey">Publishable Key</Label>
                    <Input
                      id="stripePublishableKey"
                      type="password"
                      value={payment?.stripePublishableKey || ""}
                      onChange={(e) => handlePaymentUpdate("stripePublishableKey", e.target.value)}
                      placeholder="pk_test_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripeSecretKey">Secret Key</Label>
                    <Input
                      id="stripeSecretKey"
                      type="password"
                      value={payment?.stripeSecretKeyEncrypted || ""}
                      onChange={(e) => handlePaymentUpdate("stripeSecretKeyEncrypted", e.target.value)}
                      placeholder="sk_test_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripeWebhookSecret">Webhook Secret</Label>
                    <Input
                      id="stripeWebhookSecret"
                      type="password"
                      value={payment?.stripeWebhookSecretEncrypted || ""}
                      onChange={(e) => handlePaymentUpdate("stripeWebhookSecretEncrypted", e.target.value)}
                      placeholder="whsec_..."
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {payment?.provider === "paypal" && (
              <Card>
                <CardHeader>
                  <CardTitle>PayPal Configuration</CardTitle>
                  <CardDescription>Configure your PayPal payment integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paypalClientId">Client ID</Label>
                    <Input
                      id="paypalClientId"
                      type="password"
                      value={payment?.paypalClientId || ""}
                      onChange={(e) => handlePaymentUpdate("paypalClientId", e.target.value)}
                      placeholder="PayPal Client ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypalClientSecret">Client Secret</Label>
                    <Input
                      id="paypalClientSecret"
                      type="password"
                      value={payment?.paypalClientSecretEncrypted || ""}
                      onChange={(e) => handlePaymentUpdate("paypalClientSecretEncrypted", e.target.value)}
                      placeholder="PayPal Client Secret"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypalMode">PayPal Mode</Label>
                    <Select
                      value={payment?.paypalMode || "sandbox"}
                      onValueChange={(value) => handlePaymentUpdate("paypalMode", value)}
                    >
                      <SelectTrigger id="paypalMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="live">Live (Production)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Pricing Configuration</CardTitle>
                <CardDescription>Set up pricing for your services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={payment?.currency || "USD"}
                    onChange={(e) => handlePaymentUpdate("currency", e.target.value)}
                    placeholder="USD"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xenScoutPrice">XEN Scout Review Price (cents)</Label>
                  <Input
                    id="xenScoutPrice"
                    type="number"
                    value={payment?.xenScoutPriceCents || 1000}
                    onChange={(e) => handlePaymentUpdate("xenScoutPriceCents", parseInt(e.target.value))}
                    placeholder="1000"
                  />
                  <p className="text-sm text-muted-foreground">Current price: ${((payment?.xenScoutPriceCents || 1000) / 100).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Settings</CardTitle>
                <CardDescription>Configure subscription options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableSubscriptions">Enable Subscriptions</Label>
                    <p className="text-sm text-muted-foreground">Allow monthly and yearly subscriptions</p>
                  </div>
                  <Switch
                    id="enableSubscriptions"
                    checked={payment?.enableSubscriptions || false}
                    onCheckedChange={(checked) => handlePaymentUpdate("enableSubscriptions", checked)}
                  />
                </div>

                {payment?.enableSubscriptions && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="monthlyPrice">Monthly Price (cents)</Label>
                      <Input
                        id="monthlyPrice"
                        type="number"
                        value={payment?.subscriptionMonthlyPriceCents || 0}
                        onChange={(e) => handlePaymentUpdate("subscriptionMonthlyPriceCents", parseInt(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="yearlyPrice">Yearly Price (cents)</Label>
                      <Input
                        id="yearlyPrice"
                        type="number"
                        value={payment?.subscriptionYearlyPriceCents || 0}
                        onChange={(e) => handlePaymentUpdate("subscriptionYearlyPriceCents", parseInt(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
