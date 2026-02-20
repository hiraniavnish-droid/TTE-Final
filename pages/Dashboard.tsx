
import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { DialButton } from '../components/ui/DialButton';
import { Sparkline } from '../components/ui/Sparkline';
import { useLeads } from '../contexts/LeadContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatCompactCurrency, cn, formatDate } from '../utils/helpers';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie,
  LabelList
} from 'recharts';
import { 
  Users, 
  CheckSquare, 
  TrendingUp, 
  DollarSign, 
  Clock,
  Briefcase,
  Trophy,
  Activity,
  MapPin,
  CalendarDays,
  ArrowRight,
  Package,
  PlaneTakeoff,
  PlaneLanding,
  Calendar,
  Crown,
  Filter,
  Eye,
  Zap,
  User,
  Plus,
  ArrowRightCircle,
  X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lead, ActivityLog } from '../types';
import { getAgentColor } from './Leads';

// --- Shared Helpers ---

type TimeFilter = 'This Month' | 'Last Quarter' | 'All Time';
type OpTab = 'Ongoing Now' | 'Starts Tomorrow' | 'This Week' | 'Next Week' | 'This Month';
type ActivityRange = 'Today' | 'Yesterday' | 'This Week' | 'Custom Range';

// --- Motivational Quotes ---
const QUOTES = [
  'Travel is the only thing you buy that makes you richer.',
  'Another day, another destination conquered.',
  'Turning dreams into itineraries.',
  'Let’s make someone’s holiday perfect today.'
];

const getGreeting = (name: string) => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good Morning, ${name} ☀️`;
    if (hour < 17) return `Good Afternoon, ${name} 🌤️`; 
    return `Good Evening, ${name} 🌙`;
};

// --- Activity Monitor Component (Admin Only) ---

const ActivityMonitor = ({ logs }: { logs: ActivityLog[] }) => {
    const { theme, getTextColor, getGlassClass, getInputClass } = useTheme();
    const [range, setRange] = useState<ActivityRange>('Today');
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');

    // 1. Filter Logs by Timeframe
    const filteredLogs = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Local midnight
        
        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            
            if (range === 'Today') {
                return logDate >= startOfToday;
            }
            if (range === 'Yesterday') {
                const startOfYesterday = new Date(startOfToday);
                startOfYesterday.setDate(startOfToday.getDate() - 1);
                const endOfYesterday = new Date(startOfToday); 
                return logDate >= startOfYesterday && logDate < endOfYesterday;
            }
            if (range === 'This Week') {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start
                startOfWeek.setHours(0,0,0,0);
                return logDate >= startOfWeek;
            }
            if (range === 'Custom Range') {
                if (!customStart || !customEnd) return false;
                const [startYear, startMonth, startDay] = customStart.split('-').map(Number);
                const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
                const [endYear, endMonth, endDay] = customEnd.split('-').map(Number);
                const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
                return logDate >= start && logDate <= end;
            }
            return true;
        });
    }, [logs, range, customStart, customEnd]);

    // 2. Aggregate Stats by Agent
    const agentStats = useMemo(() => {
        const stats: Record<string, { name: string, created: number, proposals: number, won: number }> = {};

        filteredLogs.forEach(log => {
            const agent = log.agentName;
            if (!stats[agent]) stats[agent] = { name: agent, created: 0, proposals: 0, won: 0 };

            if (log.actionType === 'NEW_LEAD') {
                stats[agent].created++;
            } else if (log.actionType === 'STATUS_CHANGE') {
                if (log.metadata?.newStatus === 'Proposal Sent') stats[agent].proposals++;
                if (log.metadata?.newStatus === 'Won') stats[agent].won++;
            }
        });

        return Object.values(stats);
    }, [filteredLogs]);

    // 3. Drill Down Logs
    const agentTimeline = useMemo(() => {
        if (!selectedAgent) return [];
        return filteredLogs
            .filter(l => l.agentName === selectedAgent)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [filteredLogs, selectedAgent]);

    return (
        <Card className="mb-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300')}>
                        <Zap size={20} />
                    </div>
                    <div>
                        <h3 className={cn("text-xl font-bold font-serif", getTextColor())}>Daily Activity Pulse</h3>
                        <p className={cn("text-xs opacity-60", getTextColor())}>Monitor team flow & responsiveness</p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                    <div className={cn("flex w-full overflow-x-auto whitespace-nowrap no-scrollbar p-1 rounded-lg", theme === 'light' ? "bg-slate-100" : "bg-white/10")}>
                        {(['Today', 'Yesterday', 'This Week', 'Custom Range'] as ActivityRange[]).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex-1 md:flex-none text-center",
                                    range === r 
                                        ? (theme === 'light' ? "bg-white shadow text-indigo-600" : "bg-white/20 text-white shadow") 
                                        : "opacity-50 hover:opacity-100"
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {range === 'Custom Range' && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 fade-in">
                            <input 
                                type="date" 
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className={cn("px-2 py-1.5 text-xs rounded-lg border outline-none font-bold font-mono", getInputClass())}
                            />
                            <span className="text-xs opacity-50 font-bold">to</span>
                            <input 
                                type="date" 
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className={cn("px-2 py-1.5 text-xs rounded-lg border outline-none font-bold font-mono", getInputClass())}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <table className={cn("w-full text-left text-sm", getTextColor())}>
                    <thead>
                        <tr className="border-b border-gray-500/10 text-xs uppercase tracking-wider opacity-50">
                            <th className="pb-3 pl-2">Agent</th>
                            <th className="pb-3 text-center">Created</th>
                            <th className="pb-3 text-center">Proposals</th>
                            <th className="pb-3 text-center">Deals Won</th>
                            <th className="pb-3 text-right pr-2">Efficiency</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/10">
                        {agentStats.map((stat) => {
                            const efficiency = stat.proposals > 0 ? ((stat.won / stat.proposals) * 100).toFixed(0) : '0';
                            return (
                                <tr 
                                    key={stat.name} 
                                    onClick={() => setSelectedAgent(stat.name)}
                                    className="group hover:bg-gray-500/5 transition-colors cursor-pointer"
                                >
                                    <td className="py-4 pl-2 font-medium">
                                        <div className={cn("flex items-center gap-2", selectedAgent === stat.name && "text-blue-500")}>
                                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border", getAgentColor(stat.name))}>
                                                {stat.name.charAt(0)}
                                            </div>
                                            {stat.name}
                                        </div>
                                    </td>
                                    <td className="py-4 text-center">
                                        {stat.created > 0 ? <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-bold">{stat.created}</span> : <span className="opacity-30">-</span>}
                                    </td>
                                    <td className="py-4 text-center">
                                        {stat.proposals > 0 ? <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 font-bold">{stat.proposals}</span> : <span className="opacity-30">-</span>}
                                    </td>
                                    <td className="py-4 text-center">
                                        {stat.won > 0 ? <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold">{stat.won}</span> : <span className="opacity-30">-</span>}
                                    </td>
                                    <td className="py-4 text-right pr-2 font-mono">
                                        <span className={cn(
                                            "font-bold",
                                            parseInt(efficiency) > 20 ? "text-emerald-500" : "opacity-60"
                                        )}>{efficiency}%</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {agentStats.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center opacity-50 italic">
                                    {range === 'Custom Range' && (!customStart || !customEnd) 
                                        ? "Select a date range to view activity." 
                                        : `No activity recorded for ${range}.`}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Timeline Drawer (Slide over) */}
            {selectedAgent && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedAgent(null)} />
                    <div className={cn(
                        "fixed inset-y-0 right-0 z-50 w-full max-w-sm shadow-2xl p-6 overflow-y-auto transform transition-transform duration-300",
                        getGlassClass('95'),
                        theme === 'light' ? 'bg-white' : 'bg-slate-900'
                    )}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className={cn("text-xl font-bold font-serif", getTextColor())}>{selectedAgent}'s Timeline</h3>
                                <p className="text-xs opacity-60 mt-1">
                                    {range === 'Custom Range' ? `${customStart} to ${customEnd}` : range}
                                </p>
                            </div>
                            <button onClick={() => setSelectedAgent(null)} className="p-2 hover:bg-gray-500/10 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="relative pl-4 border-l-2 border-gray-500/10 space-y-8">
                            {agentTimeline.map((log) => (
                                <div key={log.id} className="relative">
                                    <div className={cn(
                                        "absolute -left-[21px] top-0 w-3 h-3 rounded-full border-2 border-white",
                                        log.actionType === 'NEW_LEAD' ? 'bg-blue-500' : 
                                        (log.metadata?.newStatus === 'Won' ? 'bg-emerald-500' : 'bg-amber-500')
                                    )} />
                                    
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono opacity-50">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                                            log.actionType === 'NEW_LEAD' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                                        )}>
                                            {log.actionType.replace('_', ' ')}
                                        </span>
                                    </div>
                                    
                                    <p className={cn("text-sm font-medium", getTextColor())}>{log.details}</p>
                                    {log.metadata?.leadName && (
                                        <Link to={`/leads/${log.leadId}`} className="text-xs text-indigo-500 hover:underline flex items-center gap-1 mt-1">
                                            View {log.metadata.leadName} <ArrowRight size={10} />
                                        </Link>
                                    )}
                                </div>
                            ))}
                            {agentTimeline.length === 0 && (
                                <p className="text-sm opacity-50 italic">No activity logs found.</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </Card>
    );
};

// --- Admin Components ---

const AdminLeaderboard = ({ leads }: { leads: Lead[] }) => {
    const { theme, getTextColor } = useTheme();
    
    const agentStats = useMemo(() => {
        const agents: Record<string, { name: string, leads: number, won: number, revenue: number }> = {};
        
        leads.forEach(l => {
            const agent = l.assignedTo || 'Unassigned';
            if (!agents[agent]) agents[agent] = { name: agent, leads: 0, won: 0, revenue: 0 };
            
            agents[agent].leads++;
            if (l.status === 'Won') {
                agents[agent].won++;
                agents[agent].revenue += (l.commercials?.sellingPrice || l.tripDetails.budget || 0);
            }
        });

        return Object.values(agents).sort((a, b) => b.revenue - a.revenue);
    }, [leads]);

    const pieData = agentStats.map(a => ({ name: a.name, value: a.leads }));
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <div className="flex items-center gap-2 mb-6">
                    <div className={cn("p-1.5 rounded bg-amber-500/10 text-amber-500")}>
                        <Crown size={18} />
                    </div>
                    <h3 className={cn("font-bold font-serif", getTextColor())}>Team Leaderboard</h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className={cn("w-full text-left text-sm", getTextColor())}>
                        <thead>
                            <tr className="border-b border-gray-500/10 text-xs uppercase tracking-wider opacity-50">
                                <th className="pb-3 pl-2">Agent</th>
                                <th className="pb-3 text-center">Trend</th>
                                <th className="pb-3 text-center">Total Leads</th>
                                <th className="pb-3 text-center">Won</th>
                                <th className="pb-3 text-center">Conversion</th>
                                <th className="pb-3 text-right pr-2">Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-500/10">
                            {agentStats.map((agent, idx) => (
                                <tr key={agent.name} className="group hover:bg-gray-500/5 transition-colors">
                                    <td className="py-4 pl-2 font-medium flex items-center gap-2">
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                            idx === 0 ? "bg-amber-100 text-amber-600" : (theme === 'light' ? "bg-slate-100" : "bg-white/10")
                                        )}>
                                            {idx + 1}
                                        </div>
                                        {agent.name}
                                    </td>
                                    <td className="py-4 text-center">
                                        <div className="w-20 mx-auto">
                                            <Sparkline 
                                                data={[5, 10, 8, 15, 12, 20]} 
                                                color={idx === 0 ? 'amber' : 'slate'}
                                                height={24}
                                            />
                                        </div>
                                    </td>
                                    <td className="py-4 text-center font-bold">{agent.leads}</td>
                                    <td className="py-4 text-center text-emerald-500 font-bold">{agent.won}</td>
                                    <td className="py-4 text-center opacity-70 font-mono">
                                        {agent.leads > 0 ? ((agent.won / agent.leads) * 100).toFixed(1) : 0}%
                                    </td>
                                    <td className="py-4 text-right pr-2 font-mono font-bold tracking-tight">
                                        {formatCompactCurrency(agent.revenue)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card className="flex flex-col items-center justify-center">
                <h3 className={cn("font-bold font-serif mb-4 self-start", getTextColor())}>Lead Distribution</h3>
                <div className="h-[250px] md:h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, value }) => `${value}`} 
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-4 mt-4 justify-center">
                    {pieData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className={getTextColor()}>{entry.name}</span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

// --- Standard Agent Dashboard Components ---

const KPICard = ({ title, value, subtext, breakdown, icon: Icon, colorClass, onClick }: any) => {
    const { getTextColor, getCardBg } = useTheme();
    return (
        <div 
            onClick={onClick}
            className={cn(
                "p-4 md:p-5 rounded-xl border transition-all duration-300 group cursor-pointer relative overflow-hidden",
                getCardBg(),
                "border-slate-100 hover:border-slate-200 shadow-sm" // Unified shadow/border
            )}
        >
            <div className="flex justify-between items-start mb-2">
                <div className={cn("p-2 rounded-lg bg-opacity-20", colorClass)}>
                    <Icon size={18} className="text-white" />
                </div>
                {onClick && <ArrowRight size={16} className="opacity-0 group-hover:opacity-50 transition-opacity -translate-x-2 group-hover:translate-x-0" />}
            </div>
            <div className="mt-1 relative z-10">
                <p className={cn("text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-0.5", getTextColor())}>{title}</p>
                <h3 className={cn("text-xl md:text-2xl font-bold font-serif font-mono tracking-tight", getTextColor())}>{value}</h3>
                
                {breakdown ? (
                    <div className={cn("text-[9px] md:text-[10px] mt-2 pt-2 border-t border-dashed border-gray-500/20 font-mono opacity-80", getTextColor())}>
                        {breakdown}
                    </div>
                ) : (
                    subtext && <p className={cn("text-[9px] md:text-[10px] mt-1 opacity-50 truncate", getTextColor())}>{subtext}</p>
                )}
            </div>
        </div>
    );
};

// --- Logic Helpers ---
const getDashboardStats = (leads: Lead[], timeFilter: TimeFilter) => {
    const now = new Date();
    const filteredLeads = leads.filter(l => {
        const leadDate = new Date(l.createdAt);
        if (timeFilter === 'This Month') {
            return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
        }
        if (timeFilter === 'Last Quarter') {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            return leadDate >= threeMonthsAgo;
        }
        return true;
    });

    let totalRevenue = 0;
    let totalNetCost = 0;
    let wonCount = 0;
    let lostCount = 0;
    let pendingCount = 0;
    
    const revenueByAgent: Record<string, number> = {};

    filteredLeads.forEach(l => {
        const agent = l.assignedTo || 'Unassigned';
        
        if (l.status === 'Won') {
            wonCount++;
            const rev = l.commercials?.sellingPrice || 0;
            const cost = l.commercials?.netCost || 0;
            totalRevenue += rev;
            totalNetCost += cost;
            
            revenueByAgent[agent] = (revenueByAgent[agent] || 0) + rev;
        } else if (l.status === 'Lost') {
            lostCount++;
        } else if (l.status === 'New') {
            pendingCount++;
        }
    });

    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;
    const netProfit = totalRevenue - totalNetCost;

    const funnelCounts = { 'New': 0, 'Contacted': 0, 'Proposal Sent': 0, 'Discussion': 0, 'Won': 0 };
    filteredLeads.forEach(l => {
        if (funnelCounts.hasOwnProperty(l.status)) {
            // @ts-ignore
            funnelCounts[l.status]++;
        }
    });
    const funnelData = Object.entries(funnelCounts).map(([name, value]) => ({ name, value }));

    const destMap = new Map<string, any>();
    const prodMap = new Map<string, any>();

    filteredLeads.forEach(l => {
        if (l.tripDetails.destination) {
            const dest = l.tripDetails.destination;
            const key = dest.toLowerCase().trim();
            if (!destMap.has(key)) destMap.set(key, { name: dest, newCount: 0, wipCount: 0, wonCount: 0, revenue: 0 });
            const data = destMap.get(key)!;
            if (l.status === 'New') data.newCount++;
            else if (['Contacted', 'Proposal Sent', 'Discussion'].includes(l.status)) data.wipCount++;
            else if (l.status === 'Won') {
                data.wonCount++;
                data.revenue += (l.commercials?.sellingPrice || l.tripDetails.budget || 0);
            }
        }
        let serviceType = 'Custom';
        if (l.interestedServices.includes('Holiday Package')) serviceType = 'Holiday Package';
        else if (l.interestedServices.length > 0) serviceType = l.interestedServices[0];

        if (!prodMap.has(serviceType)) prodMap.set(serviceType, { name: serviceType, newCount: 0, wipCount: 0, wonCount: 0, revenue: 0 });
        const pData = prodMap.get(serviceType)!;
        if (l.status === 'New') pData.newCount++;
        else if (['Contacted', 'Proposal Sent', 'Discussion'].includes(l.status)) pData.wipCount++;
        else if (l.status === 'Won') {
            pData.wonCount++;
            pData.revenue += (l.commercials?.sellingPrice || l.tripDetails.budget || 0);
        }
    });

    const topDestinations = Array.from(destMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const productStats = Array.from(prodMap.values()).sort((a, b) => (b.newCount + b.wipCount + b.wonCount) - (a.newCount + a.wipCount + a.wonCount));

    return { totalRevenue, netProfit, winRate, pendingCount, funnelData, topDestinations, productStats, revenueByAgent };
};

const getStartOfDay = (date: Date) => { 
    const d = new Date(date); 
    d.setHours(0, 0, 0, 0); 
    return d; 
};

const addDays = (date: Date, days: number) => { 
    const d = new Date(date); 
    d.setDate(d.getDate() + days); 
    return d; 
};

const getISOWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - yearStart.getTime();
    return Math.ceil(((diff / 86400000) + 1) / 7);
};

const getOperationalLeads = (leads: Lead[], tab: OpTab) => {
    const today = getStartOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const currentWeek = getISOWeek(today);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return leads.filter(l => {
        if (l.status !== 'Won') return false;
        const startDate = getStartOfDay(new Date(l.tripDetails.startDate));
        const endDate = addDays(startDate, 5); 

        switch (tab) {
            case 'Ongoing Now': return startDate <= today && endDate >= today;
            case 'Starts Tomorrow': return startDate.getTime() === tomorrow.getTime();
            case 'This Week': return getISOWeek(startDate) === currentWeek && startDate.getFullYear() === currentYear;
            case 'Next Week': return getISOWeek(startDate) === currentWeek + 1 && startDate.getFullYear() === currentYear;
            case 'This Month': return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
            default: return false;
        }
    }).sort((a, b) => new Date(a.tripDetails.startDate).getTime() - new Date(b.tripDetails.startDate).getTime());
};

// --- Main Page Component ---

export const Dashboard = () => {
  const { leads, allLeads, reminders, activityLogs } = useLeads(); 
  const { user, users } = useAuth();
  const { theme, getTextColor, getSecondaryTextColor, getGlassClass } = useTheme();
  const navigate = useNavigate();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('This Month');
  const [opTab, setOpTab] = useState<OpTab>('Ongoing Now');
  const [viewAsAgent, setViewAsAgent] = useState<string>('all');
  
  const [quote, setQuote] = useState('');
  
  useEffect(() => {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  const dashboardLeads = useMemo(() => {
      if (user?.role !== 'admin') return leads;
      if (viewAsAgent === 'all') return allLeads;
      return allLeads.filter(l => l.assignedTo === viewAsAgent);
  }, [user, leads, allLeads, viewAsAgent]);

  const stats = useMemo(() => getDashboardStats(dashboardLeads, timeFilter), [dashboardLeads, timeFilter]);
  const opLeads = useMemo(() => getOperationalLeads(dashboardLeads, opTab), [dashboardLeads, opTab]);

  const handleNav = (path: string) => navigate(path);

  const hotLeads = dashboardLeads
        .filter((l) => l.temperature === 'Hot' && l.status !== 'Won' && l.status !== 'Lost')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
        
  const tasksToday = reminders.filter((r) => {
    const today = new Date().toDateString();
    const due = new Date(r.dueDate).toDateString();
    return today === due && !r.isCompleted;
  }).slice(0, 5);

  const getRevenueBreakdown = () => {
      if (user?.role !== 'admin' || viewAsAgent !== 'all') return null;
      const sorted = Object.entries(stats.revenueByAgent as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (sorted.length === 0) return null;
      return sorted.map(([name, val]) => `${name}: ${formatCompactCurrency(val)}`).join(' | ');
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-20 px-2 md:px-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="max-w-[70%] md:max-w-none pr-4 md:pr-0">
          <h1 className={cn("text-xl md:text-3xl font-bold font-serif text-gray-800", getTextColor())}>
              {getGreeting(user?.name || 'Expert')}
          </h1>
          <p className={cn("text-sm italic opacity-60 mt-1 font-medium line-clamp-1 md:line-clamp-none", getTextColor())}>
              "{quote}"
          </p>
        </div>
        
        <div className="flex flex-wrap md:flex-col items-end gap-2 self-end md:self-auto">
            {/* CEO Mode Switcher */}
            {user?.role === 'admin' && (
                <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-all", 
                    viewAsAgent !== 'all' ? "bg-amber-50 border-amber-200" : (theme === 'light' ? "bg-white border-slate-200" : "bg-white/10 border-white/20")
                )}>
                    <Eye size={14} className={viewAsAgent !== 'all' ? "text-amber-600" : "opacity-50"} />
                    <span className={cn("text-xs font-bold uppercase tracking-wider opacity-70 hidden md:inline", viewAsAgent !== 'all' && "text-amber-700")}>Viewing:</span>
                    <select 
                        value={viewAsAgent}
                        onChange={(e) => setViewAsAgent(e.target.value)}
                        className={cn(
                            "bg-transparent outline-none text-sm font-bold cursor-pointer", 
                            viewAsAgent !== 'all' ? "text-amber-700" : getTextColor(),
                            "[&>option]:text-black"
                        )}
                    >
                        <option value="all">Global</option>
                        {users.filter(u => u.role === 'agent').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Time Filter */}
            <div className={cn("relative p-1 rounded-lg flex gap-1", theme === 'light' ? "bg-slate-200" : "bg-white/10")}>
                {(['This Month', 'Last Quarter', 'All Time'] as TimeFilter[]).map((tf) => (
                    <button
                        key={tf}
                        onClick={() => setTimeFilter(tf)}
                        className={cn(
                            "px-2 md:px-3 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all whitespace-nowrap",
                            timeFilter === tf 
                                ? (theme === 'light' ? "bg-white shadow text-blue-600" : "bg-white/20 text-white shadow") 
                                : "opacity-50 hover:opacity-100"
                        )}
                    >
                        {tf}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* --- NEW: ACTIVITY MONITOR (ADMIN ONLY) --- */}
      {user?.role === 'admin' && viewAsAgent === 'all' && (
          <ActivityMonitor logs={activityLogs} />
      )}

      {/* --- ADMIN VIEW: Leaderboard (Only show when viewing ALL) --- */}
      {user?.role === 'admin' && viewAsAgent === 'all' && (
          <div className="mb-8">
              <AdminLeaderboard leads={dashboardLeads} />
          </div>
      )}

      {/* --- COMMON: KPIs --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KPICard 
            title={user?.role === 'admin' && viewAsAgent === 'all' ? "Total Revenue" : "Revenue"}
            value={formatCurrency(stats.totalRevenue)} 
            subtext="Closed Won Deals"
            breakdown={getRevenueBreakdown()} 
            icon={DollarSign} 
            colorClass="bg-emerald-500" 
          />
          <KPICard 
            title="Net Profit" 
            value={formatCurrency(stats.netProfit)}
            subtext="Revenue - Net Cost"
            icon={TrendingUp} 
            colorClass="bg-blue-500" 
          />
          <KPICard 
            title="Win Rate" 
            value={`${stats.winRate.toFixed(1)}%`}
            subtext="Won vs Total Closed" 
            icon={Trophy} 
            colorClass="bg-amber-500" 
          />
          <KPICard 
            title="Pending Leads" 
            value={stats.pendingCount}
            subtext="Status: New"
            icon={Clock} 
            colorClass="bg-rose-500"
            onClick={() => handleNav('/leads?status=New')}
          />
      </div>

      {/* --- AGENT VIEW / CEO DRILLDOWN --- */}
      <div className={cn(
          "grid grid-cols-1 xl:grid-cols-4 gap-6",
          viewAsAgent !== 'all' && "border-2 border-dashed border-amber-500/20 p-4 rounded-3xl relative"
      )}>
          <Card className="xl:col-span-1 min-h-[300px] flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                  <div className={cn("p-1.5 rounded bg-blue-500/10 text-blue-500")}>
                      <Activity size={16} />
                  </div>
                  <h3 className={cn("font-bold font-serif", getTextColor())}>Lead Funnel</h3>
              </div>
              
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={stats.funnelData} margin={{ left: 0, right: 30, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={80}
                      tick={{ fill: theme === 'light' ? '#64748b' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ 
                            backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(15, 23, 42, 0.95)', 
                            borderRadius: '8px', 
                            border: 'none',
                            color: theme === 'light' ? '#0f172a' : '#fff',
                            fontSize: '12px'
                        }} 
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} onClick={(data) => handleNav(`/leads?status=${data.name}`)}>
                        <LabelList dataKey="value" position="right" style={{ fontSize: '10px', fill: theme === 'light' ? '#64748b' : '#94a3b8', fontWeight: 'bold' }} />
                        {stats.funnelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={theme === 'light' ? '#3b82f6' : '#60a5fa'} className="cursor-pointer hover:opacity-80 transition-opacity" />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </Card>

          {/* Row 3: Product & Destination Matrix (75%) */}
          <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Product Matrix */}
              <Card className="flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                      <div className={cn("p-1.5 rounded bg-teal-500/10 text-teal-500")}>
                          <Package size={16} />
                      </div>
                      <h3 className={cn("font-bold font-serif", getTextColor())}>Product Matrix</h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className={cn("w-full text-left text-sm", getTextColor())}>
                          <thead>
                              <tr className="border-b border-gray-500/10 text-xs uppercase tracking-wider opacity-50">
                                  <th className="pb-3 font-bold pl-2">Service</th>
                                  <th className="pb-3 font-bold text-center">Activity</th>
                                  <th className="pb-3 font-bold text-center">Won</th>
                                  <th className="pb-3 font-bold text-right pr-2">Value</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-500/10">
                              {stats.productStats.map((prod, idx) => (
                                  <tr key={prod.name} className="group hover:bg-gray-500/5 transition-colors">
                                      <td className="py-3 pl-2 font-medium cursor-pointer truncate max-w-[100px]" title={prod.name} onClick={() => handleNav(`/leads?service=${prod.name}`)}>
                                          {prod.name}
                                      </td>
                                      <td className="py-3 text-center">
                                          <div className="w-16 mx-auto">
                                              <Sparkline 
                                                  data={[prod.newCount, prod.wipCount, prod.wonCount]} 
                                                  color="blue"
                                                  height={20}
                                              />
                                          </div>
                                      </td>
                                      <td className="py-3 text-center">
                                          <span onClick={() => handleNav(`/leads?service=${prod.name}&status=Won`)} className={cn("px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 inline-block", prod.wonCount > 0 ? "bg-emerald-500/10 text-emerald-500" : "opacity-20")}>{prod.wonCount}</span>
                                      </td>
                                      <td className="py-3 text-right pr-2 font-mono text-xs opacity-70 tracking-tight">
                                          {formatCompactCurrency(prod.revenue)}
                                      </td>
                                  </tr>
                              ))}
                              {stats.productStats.length === 0 && (
                                  <tr><td colSpan={4} className="py-8 text-center opacity-50 text-xs italic">No data</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </Card>

              {/* Destination Matrix */}
              <Card className="flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                      <div className={cn("p-1.5 rounded bg-purple-500/10 text-purple-500")}>
                          <MapPin size={16} />
                      </div>
                      <h3 className={cn("font-bold font-serif", getTextColor())}>Destination Matrix</h3>
                  </div>

                  <div className="overflow-x-auto">
                      <table className={cn("w-full text-left text-sm", getTextColor())}>
                          <thead>
                              <tr className="border-b border-gray-500/10 text-xs uppercase tracking-wider opacity-50">
                                  <th className="pb-3 font-bold pl-2">Dest</th>
                                  <th className="pb-3 font-bold text-center">Trend</th>
                                  <th className="pb-3 font-bold text-center">Won</th>
                                  <th className="pb-3 font-bold text-right pr-2">Value</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-500/10">
                              {stats.topDestinations.map((dest, idx) => (
                                  <tr key={dest.name} className="group hover:bg-gray-500/5 transition-colors">
                                      <td className="py-3 pl-2 font-medium cursor-pointer" onClick={() => handleNav(`/leads?destination=${dest.name}`)}>
                                          {idx + 1}. {dest.name}
                                      </td>
                                      <td className="py-3 text-center">
                                          <div className="w-16 mx-auto">
                                              <Sparkline 
                                                  data={[dest.newCount, dest.wipCount, dest.wonCount]} 
                                                  color="purple"
                                                  height={20}
                                              />
                                          </div>
                                      </td>
                                      <td className="py-3 text-center">
                                          <span onClick={() => handleNav(`/leads?destination=${dest.name}&status=Won`)} className={cn("px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 inline-block", dest.wonCount > 0 ? "bg-emerald-500/10 text-emerald-500" : "opacity-20")}>{dest.wonCount}</span>
                                      </td>
                                      <td className="py-3 text-right pr-2 font-mono text-xs opacity-70 tracking-tight">
                                          {formatCompactCurrency(dest.revenue)}
                                      </td>
                                  </tr>
                              ))}
                              {stats.topDestinations.length === 0 && (
                                  <tr><td colSpan={4} className="py-8 text-center opacity-50 text-xs italic">No data</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      </div>

      {/* --- Operations Manager --- */}
      <div className="space-y-4">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-300')}>
                      <PlaneTakeoff size={20} />
                  </div>
                  <div>
                      <h3 className={cn("text-xl font-bold font-serif", getTextColor())}>Operations & Departures</h3>
                      <p className={cn("text-xs opacity-60", getTextColor())}>Monitor active trips and upcoming departures</p>
                  </div>
              </div>
          </div>

          <div className={cn("rounded-2xl border overflow-hidden", getGlassClass())}>
              <div className={cn(
                  "flex overflow-x-auto w-full whitespace-nowrap no-scrollbar p-2 gap-2 border-b",
                  theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/10'
              )}>
                  {(['Ongoing Now', 'Starts Tomorrow', 'This Week', 'Next Week', 'This Month'] as OpTab[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setOpTab(tab)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0",
                            opTab === tab 
                                ? (theme === 'light' ? 'bg-white shadow text-blue-600' : 'bg-white/10 text-white shadow border border-white/10')
                                : "opacity-50 hover:opacity-100"
                        )}
                      >
                          {tab}
                      </button>
                  ))}
              </div>

              <div className="p-4 md:p-6">
                  {opLeads.length === 0 ? (
                      <div className="text-center py-12 opacity-50">
                          <PlaneLanding size={48} className="mx-auto mb-3 opacity-30" />
                          <p>No departures scheduled for {opTab}</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {opLeads.map(lead => {
                              const startDate = new Date(lead.tripDetails.startDate);
                              const today = new Date();
                              const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              
                              let statusText = '';
                              let statusColor = '';

                              if (opTab === 'Ongoing Now') { statusText = 'In Progress'; statusColor = 'text-green-500'; } 
                              else if (diffDays === 1) { statusText = 'Departing Tomorrow'; statusColor = 'text-amber-500'; } 
                              else if (diffDays > 1) { statusText = `In ${diffDays} days`; statusColor = 'text-blue-500'; } 
                              else { statusText = 'Departing Today'; statusColor = 'text-green-500'; }

                              return (
                                <div key={lead.id} className={cn("p-4 rounded-xl border transition-all hover:scale-[1.02]", theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-white/5 border-white/10')}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="min-w-0 pr-2">
                                            <h4 className={cn("font-bold text-sm truncate", getTextColor())}>{lead.name}</h4>
                                            <div className="flex items-center gap-1 text-xs opacity-70 mt-0.5 truncate">
                                                <MapPin size={10} className="shrink-0" /> {lead.tripDetails.destination}
                                            </div>
                                        </div>
                                        <DialButton phoneNumber={lead.contact.phone} className="w-8 h-8" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-gray-500/5">
                                        <Calendar size={14} className="opacity-50" />
                                        <span className={cn("text-xs font-mono", getTextColor())}>{formatDate(lead.tripDetails.startDate)}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-500/10">
                                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusColor)}>{statusText}</span>
                                        <Link to={`/leads/${lead.id}`} className="text-xs text-blue-500 hover:underline">View Trip</Link>
                                    </div>
                                </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Legacy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                      <Briefcase size={16} className={getSecondaryTextColor()} />
                      <h3 className={cn("font-bold font-serif", getTextColor())}>Priority Leads</h3>
                  </div>
                  <Link to="/leads" className="text-xs text-blue-500 hover:underline">View All</Link>
              </div>
              <div className="space-y-3">
                  {hotLeads.length === 0 ? <div className="text-center py-8 opacity-50 text-sm">No hot leads.</div> : 
                      hotLeads.map(lead => (
                          <Link key={lead.id} to={`/leads/${lead.id}`} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all hover:border-blue-500/30 group", theme === 'light' ? "bg-slate-50 border-slate-100" : "bg-white/5 border-white/5")}>
                              <div className="flex items-center gap-3">
                                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", theme === 'light' ? "bg-white text-slate-600" : "bg-white/10 text-white")}>
                                      {lead.name.charAt(0)}
                                  </div>
                                  <div>
                                      <p className={cn("text-sm font-bold", getTextColor())}>{lead.name}</p>
                                      <p className={cn("text-[10px] font-mono", getSecondaryTextColor())}>{lead.tripDetails.destination} • {formatCompactCurrency(lead.tripDetails.budget)}</p>
                                  </div>
                              </div>
                              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-blue-500" />
                          </Link>
                      ))
                  }
              </div>
          </Card>

          <Card className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                      <CalendarDays size={16} className={getSecondaryTextColor()} />
                      <h3 className={cn("font-bold font-serif", getTextColor())}>Today's Tasks</h3>
                  </div>
                  <Link to="/reminders" className="text-xs text-blue-500 hover:underline">View Agenda</Link>
              </div>
              <div className="space-y-3">
                  {tasksToday.length === 0 ? <div className="text-center py-8 opacity-50 text-sm">No pending tasks.</div> : 
                      tasksToday.map(task => (
                          <div key={task.id} className={cn("flex items-start gap-3 p-3 rounded-xl border", theme === 'light' ? "bg-white border-slate-100" : "bg-white/5 border-white/5")}>
                              <div className={cn("mt-0.5 p-1 rounded-full border", theme === 'light' ? "border-slate-300 text-slate-300" : "border-white/20 text-white/20")}><CheckSquare size={12} /></div>
                              <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium line-clamp-1", getTextColor())}>{task.task}</p>
                                  <p className={cn("text-[10px] opacity-50", getTextColor())}>Due Today</p>
                              </div>
                          </div>
                      ))
                  }
              </div>
          </Card>
      </div>
    </div>
  );
};
