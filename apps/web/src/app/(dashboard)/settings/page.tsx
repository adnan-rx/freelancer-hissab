"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Landmark, Loader2, Save, Shield, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthStore } from "@/stores/auth.store";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { apiClient } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { TaxRulesTab } from "@/components/features/tax-rules-tab";

const IBAN_PATTERN = /^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9]{11,30}$/;

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const { showSuccess, showError } = useToast();

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

  // Invoice Prefs State — overwritten by the loaded profile below; no
  // hardcoded year here since it would otherwise flash a stale "FH-2026-"
  // for every account created after that year.
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
    setIbanError(null);

    if (iban.trim() && !IBAN_PATTERN.test(iban.trim())) {
      setIbanError("Enter a valid IBAN, for example PK36MEZN0001020304050607.");
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
      showSuccess("Your changes have been saved.", "Settings updated");
    } catch (err) {
      showError(apiErrorMessage(err, "Failed to save your settings."), "Couldn't save settings");
    }
  };

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch("/users/password", { currentPassword, newPassword });
      return res.data;
    },
    // Handled locally below so the message can be paired with clearing the form.
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      showSuccess("Your other sessions have been signed out.", "Password updated");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err) => {
      showError(apiErrorMessage(err, "Failed to change your password."), "Password not updated");
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showError("Enter your current and new password.", "Password not updated");
      return;
    }
    changePasswordMutation.mutate();
  };

  const isSaving = updateProfileMutation.isPending;
  const SaveButton = ({ label }: { label: string }) => (
    <Button type="submit" disabled={isSaving}>
      {isSaving ? <Loader2 className="animate-spin" /> : <Save />} {label}
    </Button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 lg:space-y-8">
      <PageHeader
        title="Settings"
        description="Your profile, remittance bank details, invoice defaults and account security."
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User /> Profile
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Landmark /> Bank &amp; tax
          </TabsTrigger>
          <TabsTrigger value="invoicing">
            <FileText /> Invoicing
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield /> Security
          </TabsTrigger>
          {user?.isAdmin && (
            <TabsTrigger value="tax-rules">
              <Shield /> Tax rules
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your personal and business identity.</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="pt-5 sm:pt-6">
              <form onSubmit={handleSaveProfile} className="max-w-xl space-y-5">
                <Field label="Full name" htmlFor="set-name" required>
                  <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} required />
                </Field>

                <Field label="Business or brand name" htmlFor="set-business" hint="Shown on the invoices you send.">
                  <Input
                    id="set-business"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={255}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" htmlFor="set-email" hint="Contact support to change this.">
                    <Input id="set-email" value={email} disabled />
                  </Field>

                  <Field label="Phone" htmlFor="set-phone">
                    <Input id="set-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Base currency" htmlFor="set-currency">
                    <Input id="set-currency" value="PKR (Pakistani Rupee)" disabled />
                  </Field>

                  <Field label="Timezone" htmlFor="set-tz">
                    <Input id="set-tz" value="Asia/Karachi (GMT+5)" disabled />
                  </Field>
                </div>

                <SaveButton label="Save profile" />
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank & tax */}
        <TabsContent value="bank">
          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Remittance bank account</CardTitle>
                <CardDescription>Where foreign payments land, and the details SBP PRCs are issued against.</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="pt-5 sm:pt-6">
              <form onSubmit={handleSaveProfile} className="max-w-xl space-y-5">
                <Field label="Bank name" htmlFor="set-bank">
                  <Input id="set-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={255} />
                </Field>

                <Field label="Account title" htmlFor="set-title">
                  <Input
                    id="set-title"
                    value={accountTitle}
                    onChange={(e) => setAccountTitle(e.target.value)}
                    maxLength={255}
                  />
                </Field>

                <Field label="IBAN" htmlFor="set-iban" error={ibanError}>
                  <Input
                    id="set-iban"
                    value={iban}
                    onChange={(e) => {
                      setIban(e.target.value.toUpperCase());
                      setIbanError(null);
                    }}
                    placeholder="PK36MEZN0001020304050607"
                    maxLength={34}
                    invalid={!!ibanError}
                    className="font-mono"
                  />
                </Field>

                <div className="space-y-4 rounded-md border border-border bg-muted/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">PSEB registration</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {psebId
                          ? "Your export income is taxed at the reduced 0.25% rate."
                          : "Without a PSEB ID your export income is taxed at 1% instead of 0.25%."}
                      </p>
                    </div>
                    <Badge variant={psebId ? "success" : "warning"} dot>
                      {psebId ? "Registered · 0.25%" : "Not registered · 1%"}
                    </Badge>
                  </div>

                  <Field label="PSEB registration number" htmlFor="set-pseb">
                    <Input
                      id="set-pseb"
                      value={psebId}
                      onChange={(e) => setPsebId(e.target.value)}
                      maxLength={100}
                      className="font-mono"
                    />
                  </Field>
                </div>

                <SaveButton label="Save bank details" />
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoicing */}
        <TabsContent value="invoicing">
          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Invoice defaults</CardTitle>
                <CardDescription>Applied to the next invoice you create — existing invoices are untouched.</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="pt-5 sm:pt-6">
              <form onSubmit={handleSaveProfile} className="max-w-xl space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Number prefix" htmlFor="set-prefix" hint="e.g. FH-2026-">
                    <Input
                      id="set-prefix"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      maxLength={50}
                      className="font-mono"
                    />
                  </Field>

                  <Field label="Payment terms" htmlFor="set-terms">
                    <Input
                      id="set-terms"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                </div>

                <Field label="Footer and wire instructions" htmlFor="set-notes">
                  <Textarea
                    id="set-notes"
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    rows={4}
                    maxLength={1000}
                  />
                </Field>

                <SaveButton label="Save invoice defaults" />
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Security</CardTitle>
                <CardDescription>Change your password and review your session.</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="max-w-xl space-y-6 pt-5 sm:pt-6">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Field label="Current password" htmlFor="set-current-pw">
                  <PasswordInput
                    id="set-current-pw"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </Field>

                <Field
                  label="New password"
                  htmlFor="set-new-pw"
                  hint="At least 8 characters, with a letter and a number."
                >
                  <PasswordInput
                    id="set-new-pw"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>

                <Button type="submit" variant="outline" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending && <Loader2 className="animate-spin" />}
                  Update password
                </Button>
              </form>

              <div className="rounded-md border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Active session</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="success" dot>
                    Signed in
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Your session refreshes in the background while you&apos;re active.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin tax rules */}
        {user?.isAdmin && (
          <TabsContent value="tax-rules">
            <TaxRulesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
