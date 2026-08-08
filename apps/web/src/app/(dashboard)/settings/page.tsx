"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, Landmark, Shield, FileText, CheckCircle2, Save, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { data: profile, isLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();

  // Profile Form State
  const [name, setName] = useState("Ahmed Ali");
  const [businessName, setBusinessName] = useState("Ahmed Web Solutions");
  const [email, setEmail] = useState("ahmed.dev@example.com");
  const [phone, setPhone] = useState("+92 300 1234567");

  // Bank & Tax State
  const [bankName, setBankName] = useState("Meezan Bank Limited");
  const [iban, setIban] = useState("PK36MEZN0001020304050607");
  const [accountTitle, setAccountTitle] = useState("Ahmed Ali");
  const [psebId, setPsebId] = useState("PSEB-2026-98765");
  const [isFiler, setIsFiler] = useState(true);

  // Invoice Prefs State
  const [invoicePrefix, setInvoicePrefix] = useState("FH-2026-");
  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [invoiceNotes, setInvoiceNotes] = useState("Thank you for your business! Please wire foreign payments to Meezan Bank IBAN above.");

  // Save Banner
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.businessName) setBusinessName(profile.businessName);
      if (profile.email) setEmail(profile.email);
      if (profile.phone) setPhone(profile.phone);
      if (profile.bankName) setBankName(profile.bankName);
      if (profile.accountTitle) setAccountTitle(profile.accountTitle);
      if (profile.iban) setIban(profile.iban);
      if (profile.psebId) setPsebId(profile.psebId);
      if (profile.isFiler !== undefined) setIsFiler(profile.isFiler);
      if (profile.invoicePrefix) setInvoicePrefix(profile.invoicePrefix);
      if (profile.paymentTerms) setPaymentTerms(profile.paymentTerms);
      if (profile.invoiceNotes) setInvoiceNotes(profile.invoiceNotes);
    } else if (user) {
      if (user.name) setName(user.name);
      if (user.businessName) setBusinessName(user.businessName);
      if (user.email) setEmail(user.email);
    }
  }, [profile, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      businessName,
      phone,
      bankName,
      accountTitle,
      iban,
      psebId,
      isFiler,
      invoicePrefix,
      paymentTerms,
      invoiceNotes,
    };

    try {
      await updateProfileMutation.mutateAsync(payload);
      if (user) {
        setUser({ ...user, name, businessName });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.warn("Failed to update profile", err);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Settings & Preferences</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your freelancer profile, bank remittance details, invoicing settings, and security.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" /> Settings updated & saved to database!
          </div>
        )}
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="profile" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-medium">
            <User className="mr-2 h-4 w-4" /> Profile & Business
          </TabsTrigger>
          <TabsTrigger value="bank" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-medium">
            <Landmark className="mr-2 h-4 w-4" /> Bank & SBP Tax
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-medium">
            <FileText className="mr-2 h-4 w-4" /> Invoicing Prefs
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-medium">
            <Shield className="mr-2 h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-100">Freelancer Profile Information</CardTitle>
              <CardDescription className="text-slate-400">Update your personal and business identity.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Full Name</label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Business / Brand Name</label>
                  <Input 
                    value={businessName} 
                    onChange={(e) => setBusinessName(e.target.value)} 
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Email Address</label>
                    <Input 
                      value={email} 
                      disabled 
                      className="bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Phone Number</label>
                    <Input 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Default Base Currency</label>
                    <Input value="PKR (Pakistani Rupee)" disabled className="bg-slate-950 border-slate-800 text-slate-400" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Timezone</label>
                    <Input value="Asia/Karachi (GMT+5)" disabled className="bg-slate-950 border-slate-800 text-slate-400" />
                  </div>
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                  {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Profile Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Bank & Tax */}
        <TabsContent value="bank">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-100">SBP Inward Remittance Bank Account</CardTitle>
              <CardDescription className="text-slate-400">Account details for foreign remittances and SBP PRC generation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Primary Bank Name</label>
                  <Input 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)} 
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Account Title</label>
                  <Input 
                    value={accountTitle} 
                    onChange={(e) => setAccountTitle(e.target.value)} 
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">IBAN (International Bank Account Number)</label>
                  <Input 
                    value={iban} 
                    onChange={(e) => setIban(e.target.value)} 
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
                  <h4 className="text-sm font-bold text-slate-200">FBR & SBP Tax Compliance</h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Active Tax Filer Status</p>
                      <p className="text-xs text-slate-400">Active Filer on FBR ATL List</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      Active Filer (0.25% Tax)
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-medium text-slate-300">PSEB Registration Number</label>
                    <Input 
                      value={psebId} 
                      onChange={(e) => setPsebId(e.target.value)} 
                      className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                  {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Bank Details
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Invoicing */}
        <TabsContent value="invoicing">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-100">Invoice Customization & Terms</CardTitle>
              <CardDescription className="text-slate-400">Configure default invoice numbering and notes for your clients.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Invoice Number Prefix</label>
                    <Input 
                      value={invoicePrefix} 
                      onChange={(e) => setInvoicePrefix(e.target.value)} 
                      className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Default Payment Terms</label>
                    <Input 
                      value={paymentTerms} 
                      onChange={(e) => setPaymentTerms(e.target.value)} 
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Default Invoice Footer / Wire Instructions</label>
                  <textarea 
                    value={invoiceNotes} 
                    onChange={(e) => setInvoiceNotes(e.target.value)} 
                    rows={4}
                    className="w-full rounded-md border border-slate-800 bg-slate-900 p-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                  {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Invoice Preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Security */}
        <TabsContent value="security">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-100">Security & Credentials</CardTitle>
              <CardDescription className="text-slate-400">Change your password and inspect active session tokens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Current Password</label>
                  <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 text-slate-100" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">New Password</label>
                  <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 text-slate-100" />
                </div>

                <Button type="submit" variant="outline" className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800">
                  Update Password
                </Button>
              </form>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <p className="text-xs font-semibold text-slate-300">Active Authentication Session</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">JWT Bearer Token Active</Badge>
                  <span>Expires in 15 mins (Auto-refresh enabled)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
