import { useBranding } from "@/hooks/use-branding";
import { Facebook, Instagram, Mail, Phone, Globe, MapPin } from "lucide-react";
import { Link } from "wouter";
import { XIcon } from "@/components/ui/x-icon";
import { TikTokIcon } from "@/components/ui/tiktok-icon";

interface FooterProps {
  minimal?: boolean; // For minimal web-only footer
}

export default function Footer({ minimal = false }: FooterProps) {
  const { branding } = useBranding();

  // Helper function to format full address
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

  // Helper to get current year
  const currentYear = new Date().getFullYear();

  // Only show footer if there's at least some company information
  const hasCompanyInfo = 
    branding.companyName || 
    branding.companyDescription || 
    getFullAddress() || 
    branding.contactEmail || 
    branding.contactPhone || 
    branding.websiteUrl ||
    branding.socialFacebook || 
    branding.socialTwitter || 
    branding.socialInstagram || 
    branding.socialTiktok;

  if (!hasCompanyInfo) {
    return null;
  }

  // Minimal footer for web (mobile apps don't need footers)
  if (minimal) {
    return (
      <footer className="hidden lg:block bg-card border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>© {currentYear} {branding.companyName || branding.name || "LockerRoom"}</span>
              {(branding.contactEmail || branding.websiteUrl) && (
                <div className="flex items-center space-x-4">
                  {branding.contactEmail && (
                    <a href={`mailto:${branding.contactEmail}`} className="hover:text-foreground transition-colors">
                      Contact
                    </a>
                  )}
                  <Link href="/about" className="hover:text-foreground transition-colors">
                    About
                  </Link>
                </div>
              )}
            </div>
            {(branding.socialFacebook || branding.socialTwitter || branding.socialInstagram || branding.socialTiktok) && (
              <div className="flex items-center space-x-3">
                {branding.socialFacebook && (
                  <a href={branding.socialFacebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                    <Facebook className="w-4 h-4 hover:text-foreground transition-colors" />
                  </a>
                )}
                {branding.socialTwitter && (
                  <a href={branding.socialTwitter} target="_blank" rel="noopener noreferrer" aria-label="X">
                    <XIcon className="w-4 h-4 hover:text-foreground transition-colors" size={16} />
                  </a>
                )}
                {branding.socialInstagram && (
                  <a href={branding.socialInstagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <Instagram className="w-4 h-4 hover:text-foreground transition-colors" />
                  </a>
                )}
                {branding.socialTiktok && (
                  <a href={branding.socialTiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                    <TikTokIcon className="w-4 h-4 hover:text-foreground transition-colors" size={16} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info Section */}
          <div className="space-y-4">
            {branding.companyName && (
              <h3 className="text-lg font-semibold text-foreground">
                {branding.companyName}
              </h3>
            )}
            {branding.companyDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {branding.companyDescription}
              </p>
            )}
          </div>

          {/* Contact Information Section */}
          {(getFullAddress() || branding.contactEmail || branding.contactPhone || branding.websiteUrl) && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Contact
              </h4>
              <div className="space-y-3">
                {getFullAddress() && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {getFullAddress()}
                    </p>
                  </div>
                )}
                {branding.contactEmail && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={`mailto:${branding.contactEmail}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {branding.contactEmail}
                    </a>
                  </div>
                )}
                {branding.contactPhone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={`tel:${branding.contactPhone}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {branding.contactPhone}
                    </a>
                  </div>
                )}
                {branding.websiteUrl && (
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={branding.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Links Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Feed
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Search
                </Link>
              </li>
              <li>
                <Link href="/notifications" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Notifications
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Media Section */}
          {(branding.socialFacebook || branding.socialTwitter || branding.socialInstagram || branding.socialLinkedin) && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Follow Us
              </h4>
              <div className="flex flex-wrap gap-3">
                {branding.socialFacebook && (
                  <a
                    href={branding.socialFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {branding.socialTwitter && (
                  <a
                    href={branding.socialTwitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="X"
                  >
                    <XIcon className="w-5 h-5" size={20} />
                  </a>
                )}
                {branding.socialInstagram && (
                  <a
                    href={branding.socialInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {branding.socialTiktok && (
                  <a
                    href={branding.socialTiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="TikTok"
                  >
                    <TikTokIcon className="w-5 h-5" size={20} />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Copyright Section */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-sm text-center text-muted-foreground">
            © {currentYear} {branding.companyName || branding.name || "LockerRoom"}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

