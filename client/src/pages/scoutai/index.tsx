import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Sparkles, Brain, Zap, ArrowRight } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

export default function ScoutAI() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Page Title */}
        <div className="mb-8 px-4 sm:px-6 lg:px-8 pt-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">ScoutAI</h1>
          <p className="text-muted-foreground text-sm lg:text-base">AI-powered talent analysis and insights</p>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Coming Soon Card */}
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground mb-2">
              ScoutAI Coming Soon
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Revolutionary AI technology for talent scouting and analysis
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-6">
                We're working on something amazing! ScoutAI will revolutionize how scouts analyze talent, 
                providing AI-powered insights, performance predictions, and comprehensive player analytics.
              </p>
            </div>

            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center p-4 rounded-lg border border-border">
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3">
                  <Brain className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">AI Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Advanced machine learning algorithms analyze performance data and provide detailed insights.
                </p>
              </div>

              <div className="text-center p-4 rounded-lg border border-border">
                <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Predictive Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Get predictions about player potential, injury risk, and performance trends.
                </p>
              </div>

              <div className="text-center p-4 rounded-lg border border-border">
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-3">
                  <Zap className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Real-time Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Instant analysis and recommendations based on live performance data.
                </p>
              </div>
            </div>

            {/* Notification Signup */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 mt-8">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Be the First to Know
                </h3>
                <p className="text-muted-foreground mb-4">
                  Get notified when ScoutAI launches with exclusive early access.
                </p>
                <Button 
                  className="gold-gradient text-accent-foreground"
                  disabled
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Notify Me When Available
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Coming Q2 2025
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                ScoutAI will integrate seamlessly with XEN Watch submissions, 
                providing comprehensive analysis of student-athlete performance 
                and helping scouts make data-driven decisions.
              </p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
