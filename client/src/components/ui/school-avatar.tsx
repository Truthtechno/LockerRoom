import { cn } from "@/lib/utils";

interface SchoolAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
}

export function SchoolAvatar({ src, name, className, onClick, clickable = false }: SchoolAvatarProps) {
  const firstLetter = name.charAt(0).toUpperCase();
  
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        onClick={onClick}
        className={cn(
          "rounded-lg object-cover",
          clickable && "cursor-pointer hover:opacity-80 transition-opacity",
          className
        )}
      />
    );
  }
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold relative",
        clickable && "cursor-pointer hover:from-primary/30 hover:to-accent/30 transition-all hover:scale-105",
        className
      )}
    >
      <span className="text-lg">{firstLetter}</span>
      {clickable && (
        <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-white text-xs font-medium">Click to add photo</span>
        </div>
      )}
    </div>
  );
}
