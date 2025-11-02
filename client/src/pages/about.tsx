import { useBranding } from "@/hooks/use-branding";
import { useLocation } from "wouter";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Facebook, Instagram, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XIcon } from "@/components/ui/x-icon";
import { TikTokIcon } from "@/components/ui/tiktok-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

export default function About() {
  const { branding } = useBranding();
  const [, setLocation] = useLocation();

  const getFullAddress = () => {
    const parts = [
      branding.companyAddress,
      branding.companyCity,
      branding.companyState,
      branding.companyZip,
      branding.companyCountry
    ].filter(Boolean);
    return parts.join(", ");
  };

  const companyName = branding.companyName || branding.name || "LockerRoom";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => setLocation("/settings")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              {branding.companyLogoUrl ? (
                <img
                  src={branding.companyLogoUrl}
                  alt={`${companyName} logo`}
                  className="h-20 w-auto max-w-[250px] object-contain rounded-lg border border-border bg-background p-2"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    console.error("Company logo image failed to load:", branding.companyLogoUrl);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              {!branding.companyLogoUrl && (
                <div className="h-20 w-20 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-10 h-10 text-primary-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-foreground">{companyName}</h1>
                <p className="text-muted-foreground mt-1">About Us</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Company Description */}
            {branding.companyDescription && (
              <Card>
                <CardHeader>
                  <CardTitle>About {companyName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {branding.companyDescription}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            {(getFullAddress() || branding.contactEmail || branding.contactPhone || branding.websiteUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>Get in touch with us</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getFullAddress() && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Address</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getFullAddress()}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {branding.contactEmail && (
                      <a
                        href={`mailto:${branding.contactEmail}`}
                        className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{branding.contactEmail}</span>
                      </a>
                    )}

                    {branding.contactPhone && (
                      <a
                        href={`tel:${branding.contactPhone}`}
                        className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{branding.contactPhone}</span>
                      </a>
                    )}

                    {branding.websiteUrl && (
                      <a
                        href={branding.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Globe className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">Visit our website</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Media */}
            {(branding.socialFacebook || branding.socialTwitter || branding.socialInstagram || branding.socialTiktok) && (
              <Card>
                <CardHeader>
                  <CardTitle>Connect With Us</CardTitle>
                  <CardDescription>Follow us on social media</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {branding.socialFacebook && (
                      <a
                        href={branding.socialFacebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <Facebook className="w-6 h-6 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Facebook</span>
                      </a>
                    )}
                    {branding.socialTwitter && (
                      <a
                        href={branding.socialTwitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <XIcon className="w-6 h-6 text-muted-foreground mb-2" size={24} />
                        <span className="text-xs text-muted-foreground">X</span>
                      </a>
                    )}
                    {branding.socialInstagram && (
                      <a
                        href={branding.socialInstagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <Instagram className="w-6 h-6 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Instagram</span>
                      </a>
                    )}
                    {branding.socialTiktok && (
                      <a
                        href={branding.socialTiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <TikTokIcon className="w-6 h-6 text-muted-foreground mb-2" size={24} />
                        <span className="text-xs text-muted-foreground">TikTok</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Version/App Info */}
            <Card>
              <CardHeader>
                <CardTitle>App Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Platform: {branding.name || "LockerRoom"}</p>
                  <p>© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

