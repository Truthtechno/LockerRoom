import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

interface AvatarWithFallbackProps {
  src?: string | null;
  alt: string;
  fallbackText?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10", 
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

export function AvatarWithFallback({ 
  src, 
  alt, 
  fallbackText, 
  className = "", 
  size = "md" 
}: AvatarWithFallbackProps) {
  // Generate fallback text from alt if not provided
  const generateInitials = (name: string) => {
    if (!name || name.trim() === '') return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
  };
  
  const fallback = fallbackText || generateInitials(alt);
  
  // Ensure we have a valid src or use default
  const avatarSrc = src && src.trim() ? src : "/default-avatar.png";

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage 
        src={avatarSrc}
        alt={alt}
        onError={(e) => {
          // Prevent infinite loops by setting to default if current src fails
          const target = e.target as HTMLImageElement;
          if (target.src !== "/default-avatar.png") {
            target.src = "/default-avatar.png";
          }
        }}
      />
      <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}

export default AvatarWithFallback;
