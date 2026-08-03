"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);

  const isValidUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };
  

  const fetchData = async () => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      // GUEST MODE: Load from browser storage
      const localData = localStorage.getItem("guestResources");
      const allGuest = localData ? JSON.parse(localData) : [];
      // Separate archived vs active for guest mode using an 'archived' flag
      if (activeView === "archive") {
        setResources(allGuest.filter((r: any) => r.archived === true));
      } else {
        setResources(allGuest.filter((r: any) => !r.archived));
      }
    } else {
      // AUTH MODE: Hit the correct endpoint for the current view
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
      // Silently ignore GUEST_MODE errors
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

  // Compute difficulty analytics locally from resources (works for both guest + logged-in users)
  useEffect(() => {
    if (resources.length === 0) return;
    const counts: Record<string, number> = {};
    resources.forEach((r: any) => {
      const d = r.difficulty || "Unspecified";
      counts[d] = (counts[d] || 0) + 1;
    });
    const localAnalytics = Object.entries(counts).map(([name, value]) => ({ name, value }));
    setAnalyticsData(localAnalytics);
  }, [resources]);

  // Check auth status safely on client mount
  useEffect(() => {
    setIsGuest(!localStorage.getItem("authToken"));
  }, []);

  // Single useEffect for data fetching
  useEffect(() => {
    fetchData();
    if (!isGuest) {
      fetchAnalytics(); // Also fetch from backend to sync server-side data
    }
  }, [activeView, isGuest]);

  const handleLogout = async () => {
    try {
      // Call backend to invalidate the token in the database
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // If it fails (e.g. token already invalid), still proceed with local cleanup
      console.error("Backend logout failed, clearing locally", err);
    }

    // Destroy the local token
    localStorage.removeItem("authToken");

    // Clear screen data so the next person doesn't see it
    setResources([]);
    setAnalyticsData([]);

    // Force the app to re-evaluate guest state
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
        // Always update difficulty — even if null (clears stale value from a previous scan)
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

    // Validate URL before doing anything
    if (!isValidUrl(url)) {
      setUrlError("Please enter a valid URL (e.g. https://example.com)");
      return;
    }
    setUrlError(null);

    const token = localStorage.getItem("authToken");

    if (!token) {
      // GUEST MODE: Save locally without hitting the server
      const newResource = { 
        id: Date.now(), title, url, category, difficulty, 
        createdAt: new Date().toISOString() 
      };
      
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = [...current, newResource];
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated);
      
      setTitle(""); setUrl(""); setCategory("");
      return; // STOP HERE. Don't hit the server.
    }

    // AUTH MODE: Only hit the server if logged in
    try {
      const response = await authFetch("/api/resources", {
        method: "POST",
        body: JSON.stringify({
          title,
          url,
          category,
          // Send null for empty difficulty so it lands in "Unspecified" analytics bucket, not a blank-string group
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
      // GUEST MODE: Update in localStorage
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = current.map((r: any) => 
        r.id === editingResource.id 
          ? { ...r, title: editTitle, category: editCategory } 
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
        body: JSON.stringify({ title: editTitle, category: editCategory }),
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
      // GUEST MODE: Soft-delete by marking as archived (not removing)
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = current.map((r: any) => r.id === id ? { ...r, archived: true } : r);
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated.filter((r: any) => !r.archived)); // Only show active items
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
      // GUEST MODE: Un-archive the item
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = current.map((r: any) => r.id === id ? { ...r, archived: false } : r);
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated.filter((r: any) => r.archived === true)); // Stay on archive view
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
        // GUEST MODE: Permanently remove from localStorage
        const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
        const updated = current.filter((r: any) => r.id !== id);
        localStorage.setItem("guestResources", JSON.stringify(updated));
        setResources(updated.filter((r: any) => r.archived === true)); // Stay on archive view
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

  const handleAddResource = async () => {
    const token = localStorage.getItem("authToken");
    const newResource = { id: Date.now(), title, url, category, difficulty };

    if (!token) {
      // Save to LocalStorage for Guests
      const current = JSON.parse(localStorage.getItem("guestResources") || "[]");
      const updated = [...current, newResource];
      localStorage.setItem("guestResources", JSON.stringify(updated));
      setResources(updated);
    } else {
      // Send to Backend for Logged-in Users
      await authFetch("/api/resources", {
        method: "POST",
        body: JSON.stringify(newResource),
      });
      fetchData();
    }
  };

  const getResources = async () => {
    const token = localStorage.getItem("authToken");

    if (token) {
      const response = await authFetch("/api/resources");
      return await response.json();
    } else {
      const localData = localStorage.getItem("guestResources");
      return localData ? JSON.parse(localData) : [];
    }
  };


  // Filter resources based on sidebar selection
  const filteredResources = selectedCategory 
    ? resources.filter(r => r.category === selectedCategory) 
    : resources;

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
        
        {/* SIDEBAR (Folders) */}
        <aside className="w-full lg:w-64 shrink-0">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Directory Protocol</h2>
          
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all mb-4 flex items-center gap-2
              ${selectedCategory === null 
                ? "bg-white/10 text-white border border-white/20" 
                : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"}
            `}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
            </svg>
            View All Data
          </button>

          <FolderTree 
            folders={folders} 
            selectedFolder={selectedCategory} 
            onSelect={setSelectedCategory} 
          />
          <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/10 mt-8">
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
                        ${ urlError
                          ? "border-red-500/70 focus-visible:ring-red-500"
                          : url && isValidUrl(url)
                          ? "border-green-500/50 focus-visible:ring-green-500"
                          : "border-white/10 focus-visible:ring-blue-500"
                        }`}
                    />
                    <Button 
                      type="button" 
                      onClick={handleAiAutoFill}
                      disabled={isAiLoading || !url || !!urlError}
                      className="bg-white/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl h-12 px-4 transition-all group"
                    >
                      {isAiLoading ? "..." : "Scan"}
                    </Button>
                  </div>
                  {urlError && (
                    <p className="text-red-400 text-xs px-1 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {urlError}
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
                
                <Button type="submit" className="bg-blue-600/90 text-white hover:bg-blue-600 rounded-xl h-12 px-8 font-semibold shadow-md shrink-0 w-full xl:w-auto">
                  Deploy
                </Button>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredResources.map((resource: any) => (
              <Card key={resource.id} className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-1 hover:border-blue-500/50 hover:bg-zinc-900/60 transition-all shadow-xl flex flex-col justify-between">
                <CardHeader className="p-5">
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                      {resource.category}
                    </span>
                    
                    <div className="flex items-center gap-3">
                      {activeView === "tracker" ? (
                        <>
                          <button 
                            onClick={() => {
                              setEditingResource(resource);
                              setEditTitle(resource.title);
                              setEditCategory(resource.category);
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
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors ml-1">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                      </a>
                    </div>
                  </div>

                  <CardTitle className="text-xl font-semibold text-white tracking-tight mb-2 leading-snug">
                    {resource.title}
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-sm leading-relaxed mt-2">
                    Resource tracked and indexed into the database on <span className="text-zinc-300">{resource.createdAt ? new Date(resource.createdAt).toLocaleDateString() : "a previous date"}</span>. Pending review and completion.
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
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
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => setEditingResource(null)} className="text-zinc-400 hover:text-white rounded-xl">Cancel</Button>
              <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}