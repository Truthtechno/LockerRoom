import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CreditCard, Lock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PaymentPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transactionId: string) => void;
  type: "xen_watch" | "scout_ai";
  amountCents: number;
  currency: string;
  metadata?: Record<string, any>; // For storing submission data temporarily
}

export default function PaymentPortal({
  isOpen,
  onClose,
  onSuccess,
  type,
  amountCents,
  currency,
  metadata,
}: PaymentPortalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardData, setCardData] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
    zip: "",
  });

  // Fetch payment pricing (public endpoint)
  const { data: paymentConfig } = useQuery({
    queryKey: ["/api/payments/pricing"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments/pricing");
      if (!response.ok) throw new Error("Failed to fetch payment pricing");
      return response.json();
    },
    enabled: isOpen,
    staleTime: 30000, // Cache for 30 seconds
  });

  const isMockMode = paymentConfig?.mockModeEnabled !== false;
  
  // Ensure currency always has a value - use prop first, then config, then default to USD
  const effectiveCurrency = currency || paymentConfig?.currency || "USD";

  // Format currency amount
  const formatAmount = (cents: number, curr: string) => {
    const amount = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
    }).format(amount);
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s+/g, "");
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(" ") : cleaned;
  };

  // Format expiry date (MM/YY)
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, "").length <= 16) {
      setCardData({ ...cardData, number: formatted });
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    if (formatted.length <= 5) {
      setCardData({ ...cardData, expiry: formatted });
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 4) {
      setCardData({ ...cardData, cvv: value });
    }
  };

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      console.log('📤 Sending payment request:', paymentData);
      console.log('📤 Payment data keys:', Object.keys(paymentData || {}));
      console.log('📤 Payment data values:', {
        type: paymentData?.type,
        amount: paymentData?.amount,
        currency: paymentData?.currency,
        provider: paymentData?.provider
      });
      
      try {
        const response = await apiRequest("POST", "/api/payments/process", paymentData);
        const result = await response.json();
        console.log('✅ Payment API success response:', result);
        return result;
      } catch (error: any) {
        console.error('❌ Payment API error:', error);
        console.error('❌ Error message:', error.message);
        throw error; // Re-throw so onError handler can process it
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed successfully.",
      });
      onSuccess(data.transactionId);
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Payment could not be processed. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!cardData.number || !cardData.expiry || !cardData.cvv || !cardData.name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate card number (basic validation)
    const cardNumber = cardData.number.replace(/\s/g, "");
    if (cardNumber.length < 13 || cardNumber.length > 19) {
      toast({
        title: "Invalid Card Number",
        description: "Please enter a valid card number.",
        variant: "destructive",
      });
      return;
    }

    // Validate expiry
    const [month, year] = cardData.expiry.split("/");
    if (!month || !year || month.length !== 2 || year.length !== 2) {
      toast({
        title: "Invalid Expiry Date",
        description: "Please enter expiry date in MM/YY format.",
        variant: "destructive",
      });
      return;
    }

    // Validate CVV
    if (cardData.cvv.length < 3) {
      toast({
        title: "Invalid CVV",
        description: "Please enter a valid CVV.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    // For mock payments, simulate processing delay
    if (isMockMode) {
      // Simulate card validation
      const cardNumberClean = cardData.number.replace(/\s/g, "");
      
      // Test card numbers for mock mode
      // Declined: any card starting with 4000
      // Success: any other card
      const isDeclined = cardNumberClean.startsWith("4000");
      
      setTimeout(() => {
        if (isDeclined) {
          toast({
            title: "Payment Declined",
            description: "Your card was declined. Please try a different card.",
            variant: "destructive",
          });
          setIsProcessing(false);
        } else {
          // Process successful mock payment
          // Convert cents to actual amount for new API format (ensure it's a proper number)
          const amount = parseFloat((amountCents / 100).toFixed(2));
          
          const paymentPayload = {
            type: type || "xen_watch",
            amount: amount,
            currency: effectiveCurrency || "USD",
            provider: "mock",
            cardData: {
              last4: cardNumberClean.slice(-4),
              brand: cardNumberClean.startsWith("4") ? "visa" : "mastercard",
            },
            metadata: metadata || {},
          };
          
          console.log('💰 Processing mock payment:', {
            ...paymentPayload,
            amountCents,
            effectiveCurrency
          });
          
          processPaymentMutation.mutate(paymentPayload);
        }
      }, 2000); // 2 second delay to simulate processing
    } else {
      // Real payment gateway integration (Stripe/PayPal)
      // Convert cents to actual amount for new API format (ensure it's a proper number)
      const amount = parseFloat((amountCents / 100).toFixed(2));
      const selectedProvider = paymentConfig?.provider || "stripe";
      
      const paymentPayload = {
        type: type || "xen_watch",
        amount: amount,
        currency: effectiveCurrency || "USD",
        provider: selectedProvider,
        cardData: {
          number: cardData.number,
          expiry: cardData.expiry,
          cvv: cardData.cvv,
          name: cardData.name,
          zip: cardData.zip,
        },
        metadata: metadata || {},
      };
      
      console.log('💰 Processing real payment:', {
        ...paymentPayload,
        amountCents,
        effectiveCurrency
      });
      
      processPaymentMutation.mutate(paymentPayload);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setCardData({
        number: "",
        expiry: "",
        cvv: "",
        name: "",
        zip: "",
      });
      setIsProcessing(false);
      onClose();
    }
  };

  const serviceName = type === "xen_watch" ? "XEN Watch Review" : "ScoutAI Analysis";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Portal
          </DialogTitle>
          <DialogDescription>
            Complete your payment for {serviceName}
          </DialogDescription>
        </DialogHeader>

        {isMockMode && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Mock Payment Mode Active
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Use any card number for testing. Cards starting with 4000 will be declined.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b">
                <span className="text-sm font-medium text-muted-foreground">Service</span>
                <span className="text-sm font-semibold">{serviceName}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b">
                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                <span className="text-lg font-bold">{formatAmount(amountCents, effectiveCurrency, true)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="cardName">Cardholder Name</Label>
            <Input
              id="cardName"
              placeholder="John Doe"
              value={cardData.name}
              onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
              disabled={isProcessing}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={cardData.number}
                onChange={handleCardNumberChange}
                disabled={isProcessing}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                placeholder="MM/YY"
                value={cardData.expiry}
                onChange={handleExpiryChange}
                disabled={isProcessing}
                maxLength={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                type="password"
                value={cardData.cvv}
                onChange={handleCvvChange}
                disabled={isProcessing}
                maxLength={4}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip">ZIP/Postal Code (Optional)</Label>
            <Input
              id="zip"
              placeholder="12345"
              value={cardData.zip}
              onChange={(e) => setCardData({ ...cardData, zip: e.target.value })}
              disabled={isProcessing}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Secured by {isMockMode ? "Mock Payment System" : (paymentConfig?.provider ? paymentConfig.provider.toUpperCase() : "Payment Gateway")}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Pay {formatAmount(amountCents, effectiveCurrency, true)}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

