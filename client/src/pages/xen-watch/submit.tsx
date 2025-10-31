import React from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import XenWatchSubmitModal from "@/components/xen-watch/submit-modal";

export default function XenWatchSubmitPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        <XenWatchSubmitModal
          isOpen={true}
          onClose={() => setLocation("/xen-watch")}
        />
      </div>
    </div>
  );
}
