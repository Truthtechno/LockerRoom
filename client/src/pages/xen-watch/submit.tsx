import React from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import XenWatchSubmitModal from "@/components/xen-watch/submit-modal";

export default function XenWatchSubmitPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const handleClose = async () => {
    // Invalidate and refetch submissions when closing the modal
    await queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/submissions/me"] });
    await queryClient.refetchQueries({ queryKey: ["/api/xen-watch/submissions/me"] });
    setLocation("/xen-watch");
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        <XenWatchSubmitModal
          isOpen={true}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}
