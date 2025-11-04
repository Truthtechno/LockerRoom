import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import AvatarWithFallback from "@/components/ui/avatar-with-fallback"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, avatar, icon, onClick, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props}
            onClick={onClick}
            className={onClick ? "cursor-pointer" : ""}
          >
            <div className="flex items-start gap-3 w-full">
              {/* Avatar or Icon */}
              <div className="flex-shrink-0">
                {avatar ? (
                  <AvatarWithFallback
                    src={avatar.src}
                    alt={avatar.alt || "User"}
                    fallbackText={avatar.fallbackText}
                    size="md"
                    className="h-10 w-10"
                  />
                ) : icon ? (
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-muted">
                    {icon}
                  </div>
                ) : null}
              </div>
              
              {/* Content */}
              <div className="flex-1 grid gap-1 min-w-0">
                {title && <ToastTitle className="line-clamp-1">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="line-clamp-2">{description}</ToastDescription>
                )}
              </div>
              
              {/* Action Button */}
              {action && (
                <div className="flex-shrink-0">
                  {action}
                </div>
              )}
              
              {/* Close Button */}
              <ToastClose />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
