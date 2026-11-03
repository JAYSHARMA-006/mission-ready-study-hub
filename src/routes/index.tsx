import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicShell } from "@/components/public-shell";
import { DownloadButton } from "@/components/download-button";
import {
  getExamCategories,
  getLatestMaterials,
  submitContactMessage,
} from "@/lib/public-data.functions";
import { fileTypeLabel, formatFileSize, formatDate } from "@/lib/format";
import heroImg from "@/assets/hero-defense.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
  loader: async () => {
    const [categories, latest] = await Promise.all([
      getExamCategories(),
      getLatestMaterials({ data: { limit: 6 } }),
    ]);
    return { categories, latest };
  },
  head: () => ({
    meta: [
      { title: "Officer Path Academy — Defence Exam Study Material" },
      {
        name: "description",
        content:
          "Download curated notes, previous papers and practice sets for NDA, CDS, AFCAT and other defence exams. Secure, sign-in protected study material.",
      },
      { property: "og:title", content: "Officer Path Academy — Defence Exam Study Material" },
      {
        property: "og:description",
        content: "Curated defence exam study material — notes, papers and practice sets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LandingPage() {
  const { categories, latest } = Route.useLoaderData();

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 hero-grid" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
          <div>
            <p className="section-label">Mission ready · Defence exams</p>
            <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
              Every note you need to <span className="text-gradient-orange">earn your uniform</span>
            </h1>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Curated study material for NDA, CDS, AFCAT and more — handwritten notes,
              previous papers and practice sets, kept secure and always one click away.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="glow-ring">
                <Link to="/browse">Browse study material</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in to download</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free for enrolled students · Google sign-in · Secure downloads
            </p>
          </div>
          <div className="relative">
            <img
              src={heroImg}
              alt="Officers in formation at a defence academy"
              className="aspect-[4/3] w-full rounded-xl border border-border object-cover glow-ring"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="section-label">Exam categories</p>
        <h2 className="mt-2 font-display text-3xl font-bold uppercase">Choose your battlefield</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to="/browse"
              search={{ categoryId: cat.id }}
              className="glass hover-lift rounded-xl p-5"
            >
              <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                {cat.name}
              </h3>
              {cat.description && (
                <p className="mt-2 text-sm text-muted-foreground">{cat.description}</p>
              )}
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Exam categories will appear here once the academy publishes them.
            </p>
          )}
        </div>
      </section>

      {/* Latest material */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex items-end justify-between">
          <div>
            <p className="section-label">Fresh drops</p>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase">Latest material</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/browse">View all</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((m) => (
            <Card key={m.id} className="glass hover-lift">
              <CardHeader>
                <CardTitle className="font-display text-base uppercase tracking-wide">
                  {m.title}
                </CardTitle>
                <CardDescription>
                  {m.exam_categories?.name ?? "General"} · {fileTypeLabel(m.file_type, m.original_file_name)} ·{" "}
                  {formatFileSize(m.file_size)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                <DownloadButton materialId={m.id} />
              </CardContent>
            </Card>
          ))}
          {latest.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No material published yet — check back soon.
            </p>
          )}
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <p className="section-label">Contact the academy</p>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase">Questions before enrolling?</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Write to us about admissions, study material requests or access problems.
              The academy team reads every message.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </PublicShell>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await submitContactMessage({ data: { name, email, subject, message } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Message sent. We'll get back to you soon.");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  };

  return (
    <Card className="glass">
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-subject">Subject</Label>
            <Input
              id="contact-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Admission enquiry"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
