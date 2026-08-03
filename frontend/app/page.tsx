"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { authFetch } from "@/lib/api";

const DIFFICULTY_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#eab308'];

// --- Recursive Folder Component ---
const FolderTree = ({ folders, selectedFolder, onSelect, depth = 0 }: any) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {folders.map((folder: any) => (
        <div key={folder.id}>
          <button
            onClick={() => onSelect(folder.name)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${selectedFolder === folder.name 
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"}
            `}
            style={{ paddingLeft: `${(depth * 12) + 12}px` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={selectedFolder === folder.name ? "text-blue-400" : "text-zinc-500"}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            {folder.name}
          </button>
          
          {folder.subFolders && folder.subFolders.length > 0 && (
            <div className="mt-1">
              <FolderTree 
                folders={folder.subFolders} 
                selectedFolder={selectedFolder} 
                onSelect={onSelect} 
                depth={depth + 1} 
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// --- Copy Button with "Copied!" feedback ---
const CopyButton = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy link"
      className="text-zinc-500 hover:text-blue-400 transition-colors relative group"
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};

export default function Home() {
  const router = useRouter();

  const [resources, setResources] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<"tracker" | "archive">("tracker");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Domain grouping collapse state
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  // Search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const isValidUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };
  
  const getHostname = (rawUrl: string) => {
    try { return new URL(rawUrl).hostname.replace("www.", ""); } catch { return rawUrl; }
  };

  const fetchData = async () => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      const localData = localStorage.getItem("guestResources");
      const allGuest = localData ? JSON.parse(localData) : [];
      if (activeView === "archive") {
        setResources(allGuest.filter((r: any) => r.archived === true));
      } else {
        setResources(allGuest.filter((r: any) => !r.archived));
      }
    } else {
      try {
        const endpoint = activeView === "archive" ? "/api/resources/archived" : "/api/resources";
        const response = await authFetch(endpoint);
        const data = await response.json();
        setResources(data);
      } catch (err) {
        console.error("Auth failed, falling back to guest", err);
      }
    }
  };

  
  const fetchAnalytics = async () => {
    try {
      const res = await authFetch("/api/resources/analytics/difficulty");
      if (!res.ok) return;
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      setAnalyticsData(data);
    } catch (err) {
      if (err instanceof Error && err.message === "GUEST_MODE") return;
      console.error("Failed to load analytics", err);
    }
  };

  // Derive folders from resources whenever resources change
  useEffect(() => {
    const categories = [...new Set(resources.map((r: any) => r.category).filter(Boolean))];
    const derivedFolders = categories.map((cat, index) => ({
      id: index,
      name: cat,
      subFolders: [],
    }));
    setFolders(derivedFolders);
  }, [resources]);

  // Compute difficulty analytics locally — only for resources with a difficulty assigned
  useEffect(() => {
    const studyResources = resources.filter((r: any) => r.difficulty && r.difficulty.trim() !== "");
    if (studyResources.length === 0) { setAnalyticsData([]); return; }
    const counts: Record<string, number> = {};
    studyResources.forEach((r: any) => {
      counts[r.difficulty] = (counts[r.difficulty] || 0) + 1;
    });
    setAnalyticsData(Object.entries(counts).map(([name, value]) => ({ name, value })));
  }, [resources]);

  useEffect(() => {
    setIsGuest(!localStorage.getItem("authToken"));
  }, []);

  useEffect(() => {
    fetchData();
    if (!isGuest) {
      fetchAnalytics();
    }
  }, [activeView, isGuest]);

  const handleLogout = async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Backend logout failed, clearing locally", err);
    }
    localStorage.removeItem("authToken");
    setResources([]);
    setAnalyticsData([]);
    setIsGuest(true);
    window.location.href = "/";
  };

  const handleAiAutoFill = async () => {
    if (!url) {
      alert("Please paste a URL first!");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      alert("AI Scan requires an account. Sign in to use this feature!");
      return;
    }
    
    setIsAiLoading(true);
    try {
      const response = await authFetch(`/api/resources/analyze?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.title) setTitle(data.title);
        if (data.category) setCategory(data.category);
        setDifficulty(data.difficulty ?? "");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "GUEST_MODE") return;
      console.error("AI Auto-fill failed:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidUrl(url)) {
      setUrlError("Please enter a valid URL (e.g. https://example.com)");
      return;
    }
    setUrlError(null);

    const token = localStorage.getItem("authToken");

    if (!token) {
      const newResource = { 
        id: Date.now(), title, url, category, difficulty, 
        createdAt: new Date().toISOString() 
      };
      
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = [...current, newResource];
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated);
      
      setTitle(""); setUrl(""); setCategory("");
      return;
    }

    try {
      const response = await authFetch("/api/resources", {
        method: "POST",
        body: JSON.stringify({
          title,
          url,
          category,
          difficulty: difficulty.trim() !== "" ? difficulty : null,
        }),
      });

      if (!response.ok) throw new Error("Deploy Failed");

      setTitle("");
      setUrl("");
      setCategory("");
      fetchData();
    } catch (error) {
      if (error instanceof Error && error.message === "GUEST_MODE") return;
      alert("Network Error: Could not reach the server.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingResource) return;
    const token = localStorage.getItem("authToken");

    if (!token) {
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = current.map((r: any) => 
        r.id === editingResource.id 
          ? { ...r, title: editTitle, category: editCategory, note: editNote } 
          : r
      );
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated);
      setEditingResource(null);
      return;
    }
    
    try {
      const response = await authFetch(`/api/resources/${editingResource.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: editTitle, category: editCategory, note: editNote }),
      });

      if (!response.ok) throw new Error("Failed to update");

      setEditingResource(null);
      fetchData();
    } catch (error) {
      if (error instanceof Error && error.message === "GUEST_MODE") return;
      console.error("Error updating resource:", error);
    }
  };

  const handleArchive = async (id: number) => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = current.map((r: any) => r.id === id ? { ...r, archived: true } : r);
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated.filter((r: any) => !r.archived));
      return;
    }

    try {
      const response = await authFetch(`/api/resources/${id}`, { method: "DELETE" });
      if (response.ok) setResources(resources.filter((r) => r.id !== id));
    } catch (error) {
      if (error instanceof Error && error.message === "GUEST_MODE") return;
      console.error("Failed to archive resource:", error);
    }
  };

  const handleRestore = async (id: number) => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = current.map((r: any) => r.id === id ? { ...r, archived: false } : r);
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated.filter((r: any) => r.archived === true));
      return;
    }

    try {
      const response = await authFetch(`/api/resources/${id}/restore`, { method: "PUT" });
      if (response.ok) setResources(resources.filter((r) => r.id !== id));
    } catch (error) {
      if (error instanceof Error && error.message === "GUEST_MODE") return;
      console.error("Failed to restore resource:", error);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (confirm("Are you sure? This will delete the resource forever.")) {
      const token = localStorage.getItem("authToken");

      if (!token) {
        const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
        const updated = current.filter((r: any) => r.id !== id);
        localStorage.setItem("guestResources", JSON.stringify(updated));
        setResources(updated.filter((r: any) => r.archived === true));
        return;
      }

      try {
        const response = await authFetch(`/api/resources/${id}/permanent`, { method: "DELETE" });
        if (response.ok) setResources(resources.filter((r) => r.id !== id));
      } catch (error) {
        if (error instanceof Error && error.message === "GUEST_MODE") return;
        console.error("Failed to delete permanently:", error);
      }
    }
  };

  // Filter resources based on sidebar selection
  const filteredResources = selectedCategory 
    ? resources.filter(r => r.category === selectedCategory) 
    : resources;

  // --- Feature 5: Domain Grouping ---
  // Group resources by domain if 3+ exist from the same domain
  const domainCounts: Record<string, number> = {};
  filteredResources.forEach((r: any) => {
    const domain = getHostname(r.url);
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });

  const toggleDomain = (domain: string) => {
    setCollapsedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) { next.delete(domain); } else { next.add(domain); }
      return next;
    });
  };

  // Unique categories for pill filters
  const allCategories = [...new Set(resources.map((r: any) => r.category).filter(Boolean))];

  // Combined filter: category + search query
  const filteredResources = (() => {
    let result = selectedCategory
      ? resources.filter((r: any) => r.category === selectedCategory)
      : resources;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r: any) =>
        r.title?.toLowerCase().includes(q) ||
        r.url?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q)
      );
    }
    return result;
  })();

  const handleBulkArchive = async () => {
    const token = localStorage.getItem("authToken");
    for (const id of selectedIds) {
      if (!token) {
        const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
        const updated = current.map((r: any) => r.id === id ? { ...r, archived: true } : r);
        localStorage.setItem("guestResources", JSON.stringify(updated));
      } else {
        try { await authFetch(`/api/resources/${id}`, { method: "DELETE" }); } catch {}
      }
    }
    setSelectedIds([]);
    fetchData();
  };

  const renderCard = (resource: any) => {
    const isSelected = selectedIds.includes(resource.id);
    return (
    <Card
      key={resource.id}
      onClick={() => window.open(resource.url, "_blank")}
      className={`bg-zinc-900/40 backdrop-blur-xl border rounded-2xl p-1 transition-all shadow-xl flex flex-col justify-between cursor-pointer
        hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]
        ${isSelected
          ? "border-blue-500/60 bg-blue-950/20"
          : "border-white/10 hover:border-blue-500/40 hover:bg-zinc-900/60"
        }`}
    >
      <CardHeader className="p-5">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-blue-500 bg-zinc-900 border-zinc-700 rounded cursor-pointer"
                checked={isSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(prev => [...prev, resource.id]);
                  } else {
                    setSelectedIds(prev => prev.filter(id => id !== resource.id));
                  }
                }}
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
              {resource.category}
            </span>
          </div>
          
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {activeView === "tracker" ? (
              <>
                <button 
                  onClick={() => {
                    setEditingResource(resource);
                    setEditTitle(resource.title);
                    setEditCategory(resource.category);
                    setEditNote(resource.note || "");
                  }}
                  className="text-zinc-500 hover:text-blue-400 transition-colors text-xs font-semibold uppercase tracking-widest"
                >
                  Edit
                </button>
                <button onClick={() => handleArchive(resource.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => handleRestore(resource.id)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-blue-400">
                  Restore
                </button>
                <button onClick={() => handlePermanentDelete(resource.id)} className="text-zinc-600 hover:text-red-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            )}
            {/* Copy Link */}
            <CopyButton url={resource.url} />
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors ml-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </a>
          </div>
        </div>

        <CardTitle className="text-xl font-semibold text-white tracking-tight mb-2 leading-snug">
          {resource.title}
        </CardTitle>

        {/* Feature 3: Personal Note display */}
        {resource.note && (
          <p className="text-sm text-zinc-500 italic mt-1 mb-2 leading-relaxed">
            {resource.note}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Source domain */}
          <span className="text-[11px] font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 truncate max-w-[160px]">
            {getHostname(resource.url)}
          </span>

          {/* Difficulty badge — only shown when difficulty exists */}
          {resource.difficulty && (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${
              resource.difficulty === "Beginner"
                ? "text-green-400 bg-green-500/10 border-green-500/20"
                : resource.difficulty === "Intermediate"
                ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                : "text-red-400 bg-red-500/10 border-red-500/20"
            }`}>
              {resource.difficulty}
            </span>
          )}

          {/* Date */}
          <span className="text-[11px] text-zinc-600 ml-auto">
            {resource.createdAt
              ? new Date(resource.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—"}
          </span>
        </div>
      </CardHeader>
    </Card>
  );
};

  // Group resources by domain for Feature 5
  const renderResourceGrid = () => {
    const domainsWithMany = Object.entries(domainCounts)
      .filter(([, count]) => count >= 3)
      .map(([domain]) => domain);

    if (domainsWithMany.length === 0) {
      // No grouping needed
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredResources.map((resource: any) => renderCard(resource))}
        </div>
      );
    }

    // Separate grouped domains from ungrouped
    const grouped: Record<string, any[]> = {};
    const ungrouped: any[] = [];

    filteredResources.forEach((r: any) => {
      const domain = getHostname(r.url);
      if (domainsWithMany.includes(domain)) {
        if (!grouped[domain]) grouped[domain] = [];
        grouped[domain].push(r);
      } else {
        ungrouped.push(r);
      }
    });

    return (
      <div className="space-y-8">
        {/* Grouped domain sections */}
        {Object.entries(grouped).map(([domain, domainResources]) => {
          const isCollapsed = collapsedDomains.has(domain);
          return (
            <div key={domain}>
              <button
                onClick={() => toggleDomain(domain)}
                className="flex items-center gap-2 mb-3 group w-full text-left"
              >
                <div className="h-[1px] w-4 bg-white/20 group-hover:bg-blue-500/50 transition-colors" />
                <span className="text-xs font-mono text-zinc-400 group-hover:text-blue-400 transition-colors uppercase tracking-widest">
                  {domain} · {domainResources.length} links
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-zinc-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <div className="h-[1px] flex-1 bg-white/10 group-hover:bg-blue-500/20 transition-colors" />
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {domainResources.map((resource: any) => renderCard(resource))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped resources */}
        {ungrouped.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ungrouped.map((resource: any) => renderCard(resource))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-black text-[#a1a1aa] font-sans antialiased selection:bg-blue-500 selection:text-white pb-24 relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0" />

      <nav className="relative z-10 flex justify-between items-center px-6 md:px-12 py-8 max-w-7xl mx-auto">
        <div className="text-white font-bold text-2xl tracking-tighter">
          CC<span className="text-blue-500">.</span>
        </div>
        <div className="flex gap-8 text-sm font-medium text-zinc-500 items-center">
          <span onClick={() => { setActiveView("tracker"); setSelectedCategory(null); }} className={`cursor-pointer transition-colors ${activeView === "tracker" ? "text-white" : "hover:text-zinc-300"}`}>
            Tracker
          </span>
          <span onClick={() => { setActiveView("archive"); setSelectedCategory(null); }} className={`cursor-pointer transition-colors ${activeView === "archive" ? "text-white" : "hover:text-zinc-300"}`}>
            Recycle Bin
          </span>
          {!isGuest && (
            <button
              onClick={handleLogout}
              className="cursor-pointer text-zinc-600 hover:text-red-400 transition-colors ml-2 flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          )}
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 mt-12 flex flex-col lg:flex-row gap-12">
        
        {/* SIDEBAR — Difficulty chart only */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/10">
            <h3 className="text-white font-semibold mb-4 text-xs uppercase tracking-widest">Difficulty Distribution</h3>
            <div className="h-52">
              {analyticsData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8M12 8v8" />
                  </svg>
                  <p className="text-zinc-500 text-xs text-center">Add resources to see<br/>difficulty breakdown</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={62}
                      innerRadius={28}
                      paddingAngle={3}
                    >
                      {analyticsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DIFFICULTY_COLORS[index % DIFFICULTY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(value: any, name: any) => [`${value} resource${value !== 1 ? 's' : ''}`, name]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                      formatter={(value) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 min-w-0">
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-tight drop-shadow-lg">
              {activeView === "tracker" ? "COMMAND" : "ARCHIVE"}<br />CENTER
            </h1>
            <div className="flex items-center gap-4 text-zinc-400 text-xs tracking-[0.2em] uppercase font-semibold">
              <span>{selectedCategory ? `Viewing Protocol: ${selectedCategory}` : (activeView === "tracker" ? "Skill & Resource Protocol" : "Deleted & Deprecated Resources")}</span>
              <div className="h-[1px] w-12 bg-white/20"></div>
            </div>
          </div>
        
          {activeView === "tracker" && (
            <div className="mb-16">
              <form onSubmit={handleSubmit} noValidate className="flex flex-col xl:flex-row gap-4 items-end">
                <div className="w-full xl:w-1/3">
                  <Input 
                    placeholder="Resource Title..." 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 h-12 px-5 shadow-lg"
                  />
                </div>

                <div className="w-full flex flex-col gap-1 xl:w-1/3">
                  <div className="flex gap-2">
                    <Input 
                      type="text"
                      placeholder="https://..." 
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (e.target.value === "") {
                          setUrlError(null);
                        } else if (!isValidUrl(e.target.value)) {
                          setUrlError("Please enter a valid URL (e.g. https://example.com)");
                        } else {
                          setUrlError(null);
                        }
                      }}
                      required
                      className={`bg-white/5 backdrop-blur-xl text-white placeholder:text-zinc-500 rounded-xl focus-visible:ring-1 h-12 px-5 shadow-lg flex-1 transition-colors
                        ${ urlError || Boolean(url && resources.some((r: any) => r.url.toLowerCase() === url.toLowerCase()))
                          ? "border-red-500/70 focus-visible:ring-red-500"
                          : url && isValidUrl(url)
                          ? "border-green-500/50 focus-visible:ring-green-500"
                          : "border-white/10 focus-visible:ring-blue-500"
                        }`}
                    />
                    <Button 
                      type="button" 
                      onClick={handleAiAutoFill}
                      disabled={Boolean(isAiLoading || !url || urlError || resources.some((r: any) => r.url.toLowerCase() === url.toLowerCase()))}
                      className="bg-white/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl h-12 px-4 transition-all group disabled:opacity-50"
                    >
                      {isAiLoading ? "..." : "Scan"}
                    </Button>
                  </div>
                  {urlError && (
                    <p className="text-red-400 text-xs px-1 flex items-center gap-1 mt-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {urlError}
                    </p>
                  )}
                  {Boolean(!urlError && url && resources.some((r: any) => r.url.toLowerCase() === url.toLowerCase())) && (
                    <p className="text-red-400 text-xs px-1 flex items-center gap-1 mt-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      You have already saved this link!
                    </p>
                  )}
                </div>

                <div className="w-full xl:w-1/4">
                  <Input 
                    placeholder="Category" 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 h-12 px-5 shadow-lg"
                  />
                </div>
                
                <Button type="submit" disabled={Boolean(urlError || !url || resources.some((r: any) => r.url.toLowerCase() === url.toLowerCase()))} className="bg-blue-600/90 text-white hover:bg-blue-600 rounded-xl h-12 px-8 font-semibold shadow-md shrink-0 w-full xl:w-auto disabled:opacity-50">
                  Deploy
                </Button>
              </form>
            </div>
          )}

          {/* Search Bar + Category Pills Row */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            {/* Expandable Search */}
            <div
              className={`flex items-center bg-zinc-900/50 border border-white/10 rounded-full transition-all duration-300 ease-in-out overflow-hidden ${
                isSearchOpen ? "w-64 px-3 py-2 shadow-[0_0_15px_rgba(59,130,246,0.08)]" : "w-10 h-10 cursor-pointer justify-center"
              }`}
              onClick={() => !isSearchOpen && setIsSearchOpen(true)}
            >
              <svg
                className="w-4 h-4 text-zinc-400 shrink-0 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsSearchOpen(v => !v); if (isSearchOpen) setSearchQuery(""); }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none ml-2 transition-all duration-300 ${
                  isSearchOpen ? "opacity-100 w-full" : "opacity-0 w-0 pointer-events-none"
                }`}
                autoFocus={isSearchOpen}
              />
            </div>

            {/* Divider */}
            {allCategories.length > 0 && <div className="h-5 w-px bg-white/10" />}

            {/* Category Pills */}
            {allCategories.length > 0 && (
              <>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all border ${
                    selectedCategory === null
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                      : "text-zinc-500 border-white/10 hover:text-zinc-300 hover:border-white/20"
                  }`}
                >
                  All
                </button>
                {allCategories.map((cat: string) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all border ${
                      selectedCategory === cat
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                        : "text-zinc-500 border-white/10 hover:text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Resource Cards (with domain grouping) */}
          {renderResourceGrid()}
        </div>

      </div>
      
      {/* Guest mode banner */}
      {isGuest && (
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 mt-8">
          <div className="bg-blue-600/10 border border-blue-500/50 p-4 rounded-xl mb-8">
            <p className="text-blue-200 text-sm">
              You are in Guest Mode! Your data is saved locally on this browser.
              <button onClick={() => router.push('/login')} className="ml-2 underline font-bold hover:text-white transition-colors">
                Sign in
              </button>
              {" or "}
              <button onClick={() => router.push('/register')} className="underline font-bold hover:text-white transition-colors">
                create an account
              </button>
              {" to sync your data across devices."}
            </p>
          </div>
        </div>
      )}

      {/* Edit Modal — Feature 3: Personal Note textarea */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Edit Protocol</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">Resource Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-white/5 border-white/10 text-white rounded-xl h-12" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">Category</label>
                <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="bg-white/5 border-white/10 text-white rounded-xl h-12" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">Personal Note <span className="normal-case text-zinc-600 tracking-normal">(optional)</span></label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Why did you save this? What's it for?"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => setEditingResource(null)} className="text-zinc-400 hover:text-white rounded-xl">Cancel</Button>
              <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl">Save Changes</Button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Bulk Action Bar */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 transition-all duration-500 z-50 ${
        selectedIds.length > 0 ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
      }`}>
        <div className="flex items-center gap-6 bg-zinc-900/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl">
          <span className="text-white font-medium text-sm">
            <span className="text-blue-400">{selectedIds.length}</span> selected
          </span>
          <button
            onClick={() => setSelectedIds([])}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkArchive}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
          >
            Archive All
          </button>
        </div>
      </div>

    </main>
  );
}