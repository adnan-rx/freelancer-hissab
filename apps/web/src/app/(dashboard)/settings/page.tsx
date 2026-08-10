"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, Landmark, Shield, FileText, Save, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { apiClient } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/utils";
import { Toast } from "@/components/ui/toast";
import { TaxRulesTab } from "@/components/features/tax-rules-tab";

const IBAN_PATTERN = /^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9]{11,30}$/;

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { data: profile, isLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();

  // Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");

  // Bank & Tax State
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [accountTitle, setAccountTitle] = useState(user?.name || "");
  const [psebId, setPsebId] = useState("");
  const [isFiler, setIsFiler] = useState(true);

  // Invoice Prefs State
  const [invoicePrefix, setInvoicePrefix] = useState("FH-2026-");
  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ibanError, setIbanError] = useState<string | null>(null);

  useEffect(() => {
    const pObj = profile?.data?.id ? profile.data : (profile?.id ? profile : (profile?.data || profile));

    if (pObj) {
      const pName = pObj.name;
      const pBusinessName = pObj.businessName ?? pObj.business_name;
      const pEmail = pObj.email;
      const pPhone = pObj.phone;
      const pBankName = pObj.bankName ?? pObj.bank_name;
      const pAccountTitle = pObj.accountTitle ?? pObj.account_title ?? pObj.name;
      const pIban = pObj.iban;
      const pPsebId = pObj.psebId ?? pObj.pseb_id;
      const pIsFiler = pObj.isFiler ?? pObj.is_filer;
      const pInvoicePrefix = pObj.invoicePrefix ?? pObj.invoice_prefix;
      const pPaymentTerms = pObj.paymentTerms ?? pObj.payment_terms;
      const pInvoiceNotes = pObj.invoiceNotes ?? pObj.invoice_notes;

      if (pName) setName(pName);
      if (pBusinessName !== undefined && pBusinessName !== null) setBusinessName(pBusinessName);
      if (pEmail) setEmail(pEmail);
      if (pPhone !== undefined && pPhone !== null) setPhone(pPhone);
      if (pBankName !== undefined && pBankName !== null) setBankName(pBankName);
      if (pAccountTitle !== undefined && pAccountTitle !== null) setAccountTitle(pAccountTitle);
      if (pIban !== undefined && pIban !== null) setIban(pIban);
      if (pPsebId !== undefined && pPsebId !== null) setPsebId(pPsebId);
      if (pIsFiler !== undefined && pIsFiler !== null) setIsFiler(pIsFiler);
      if (pInvoicePrefix !== undefined && pInvoicePrefix !== null) setInvoicePrefix(pInvoicePrefix);
      if (pPaymentTerms !== undefined && pPaymentTerms !== null) setPaymentTerms(pPaymentTerms);
      if (pInvoiceNotes !== undefined && pInvoiceNotes !== null) setInvoiceNotes(pInvoiceNotes);
    } else if (user) {
      if (user.name) {
        setName(user.name);
        setAccountTitle(user.name);
      }
      if (user.businessName) setBusinessName(user.businessName);
      if (user.email) setEmail(user.email);
    }
  }, [profile, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIbanError(null);
    setSavedSuccess(null);

    if (iban.trim() && !IBAN_PATTERN.test(iban.trim())) {
      setIbanError("Enter a valid IBAN, e.g. PK36MEZN0001020304050607.");
      return;
    }

    const payload = {
      name,
      businessName,
      phone,
      bankName,
      accountTitle,
      iban: iban.trim() || undefined,
      psebId,
      isFiler,
      invoicePrefix,
      paymentTerms,
      invoiceNotes,
    };

    try {
      await updateProfileMutation.mutateAsync(payload);
      if (user) {
        setUser({ ...user, name, businessName, psebId: psebId || null, hasPseb: !!psebId });
      }
      setSavedSuccess("Settings updated & saved to database!");
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Failed to save your settings."));
    }
  };

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch("/users/password", { currentPassword, newPassword });
      return res.data;
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err) => {
      setPasswordError(apiErrorMessage(err, "Failed to change your password."));
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword || !newPassword) {
      setPasswordError("Enter your current and new password.");
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings & Preferences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your freelancer profile, bank remittance details, invoicing settings, and security.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <Toast type="success" title="Saved" message={savedSuccess} onClose={() => setSavedSuccess(null)} />
      )}
      {saveError && (
        <Toast type="error" title="Save Failed" message={saveError} onClose={() => setSaveError(null)} />
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted border border-border p-1 rounded-xl">
          <TabsTrigger value="profile" className="data-[state=active]:bg-background data-[state=active]:text-foreground font-medium">
            <User className="mr-2 h-4 w-4" /> Profile & Business
          </TabsTrigger>
          <TabsTrigger value="bank" className="data-[state=active]:bg-background data-[state=active]:text-foreground font-medium">
            <Landmark className="mr-2 h-4 w-4" /> Bank & SBP Tax
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="data-[state=active]:bg-background data-[state=active]:text-foreground font-medium">
            <FileText className="mr-2 h-4 w-4" /> Invoicing Prefs
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-background data-[state=active]:text-foreground font-medium">
            <Shield className="mr-2 h-4 w-4" /> Security
          </TabsTrigger>
          {user?.isAdmin && (
            <TabsTrigger value="tax-rules" className="data-[state=active]:bg-background data-[state=active]:text-foreground font-medium text-primary">
              <Shield className="mr-2 h-4 w-4" /> Admin: Tax Rules
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Freelancer Profile Information</CardTitle>
              <CardDescription>Update your personal and business identity.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Full Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={255}
                    required
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Business / Brand Name</label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={255}
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email Address</label>
                    <Input
                      value={email}
                      disabled
                      className="bg-muted border-input text-muted-foreground cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Phone Number</label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={50}
                      className="bg-background border-input text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Default Base Currency</label>
                    <Input value="PKR (Pakistani Rupee)" disabled className="bg-muted border-input text-muted-foreground cursor-not-allowed" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Timezone</label>
                    <Input value="Asia/Karachi (GMT+5)" disabled className="bg-muted border-input text-muted-foreground cursor-not-allowed" />
                  </div>
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Profile Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Bank & Tax */}
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">SBP Inward Remittance Bank Account</CardTitle>
              <CardDescription>Account details for foreign remittances and SBP PRC generation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Primary Bank Name</label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    maxLength={255}
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Account Title</label>
                  <Input
                    value={accountTitle}
                    onChange={(e) => setAccountTitle(e.target.value)}
                    maxLength={255}
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">IBAN (International Bank Account Number)</label>
                  <Input
                    value={iban}
                    onChange={(e) => { setIban(e.target.value.toUpperCase()); setIbanError(null); }}
                    placeholder="PK36MEZN0001020304050607"
                    maxLength={34}
                    className="bg-background border-input text-foreground font-mono"
                  />
                  {ibanError && <p className="text-xs text-destructive">{ibanError}</p>}
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-4">
                  <h4 className="text-sm font-bold text-foreground">FBR & SBP Tax Compliance</h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">PSEB Registration</p>
                      <p className="text-xs text-muted-foreground">
                        {psebId ? "Applies the 0.25% reduced export tax rate." : "Add a PSEB ID to unlock the reduced 0.25% export rate."}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={psebId ? "border-primary/30 text-primary bg-primary/10" : "border-amber-500/30 text-amber-600 bg-amber-500/10"}
                    >
                      {psebId ? "PSEB Registered (0.25% Tax)" : "Not Registered (1% Tax)"}
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-medium text-foreground">PSEB Registration Number</label>
                    <Input
                      value={psebId}
                      onChange={(e) => setPsebId(e.target.value)}
                      maxLength={100}
                      className="bg-background border-input text-foreground text-xs font-mono"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Bank Details
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Invoicing */}
        <TabsContent value="invoicing">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Invoice Customization & Terms</CardTitle>
              <CardDescription>
                Used as the default invoice number prefix, payment terms, and footer text the next time you create an invoice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Invoice Number Prefix</label>
                    <Input
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      maxLength={50}
                      className="bg-background border-input text-foreground font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Default Payment Terms</label>
                    <Input
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      maxLength={100}
                      className="bg-background border-input text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Default Invoice Footer / Wire Instructions</label>
                  <textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Invoice Preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Security & Credentials</CardTitle>
              <CardDescription>Change your password and inspect active session tokens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              {passwordError && (
                <Toast type="error" title="Password Not Updated" message={passwordError} onClose={() => setPasswordError(null)} />
              )}
              {passwordSuccess && (
                <Toast
                  type="success"
                  title="Password Updated"
                  message="Your other sessions have been signed out."
                  onClose={() => setPasswordSuccess(false)}
                />
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Current Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">New Password</label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters, with a letter and a number"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <Button type="submit" variant="outline" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update Password
                </Button>
              </form>

              <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-2">
                <p className="text-xs font-semibold text-foreground">Active Authentication Session</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">JWT Bearer Token Active</Badge>
                  <span>Expires in 2 minutes (auto-refreshed while you're active)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Admin Tax Rules */}
        {user?.isAdmin && (
          <TabsContent value="tax-rules">
            <TaxRulesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
