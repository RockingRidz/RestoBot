import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../lib/api';
import { AccountSetupBar } from './AccountSetupBar';
import { 
  Terminal, 
  Play, 
  Cpu, 
  Database, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Sliders, 
  Code2, 
  BookOpen, 
  Plus,
  Trash2,
  Gauge
} from 'lucide-react';

export const BackendTestingConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'task1_substitute' | 'task2_daily_note' | 'ai_model' | 'rag_suppliers' | 'weather_events' | 'ingestion' | 'alerts' | 'forecast' | 'crud'>('ai_model');

  // API Responses & Logs
  const [healthData, setHealthData] = useState<any>(null);
  const [apiLog, setApiLog] = useState<{ time: string; endpoint: string; status: number; payload: any }[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Supplier RAG Search state
  const [ragQueryInput, setRagQueryInput] = useState<string>('Refined Frying Oil');
  const [ragPriceInput, setRagPriceInput] = useState<number>(2.40);
  const [ragOutput, setRagOutput] = useState<any>(null);

  // Weather & Traffic Forecast state
  const [weatherLocation, setWeatherLocation] = useState<string>('Austin, TX (US)');
  const [weatherTemp, setWeatherTemp] = useState<number>(88);
  const [weatherCondition, setWeatherCondition] = useState<string>('Sunny/Hot');
  const [eventTraffic, setEventTraffic] = useState<string>('Stadium Concert nearby (+20% crowd)');
  const [useLiveWeather, setUseLiveWeather] = useState<boolean>(true);
  const [weatherOutput, setWeatherOutput] = useState<any>(null);

  // AI Training & Prompt Tuning state
  const [systemPrompt, setSystemPrompt] = useState<string>(
    `You are RestoBot AI, a precise restaurant inventory co-pilot. Your job is to format owner notes and recommend ingredient substitutes based strictly on input JSON data.

RULES:
1. NEVER invent sales data, ingredient prices, or recipe requirements.
2. ALWAYS return structured JSON when evaluating margin risks or substitutions.
3. Keep owner notes practical, short, and supplier-ready.
4. Highlight margin threats clearly when an ingredient cost is elevated above normal.
5. Always double check using the US market directory (Sysco, US Foods, GFS, PFG) and live weather for precise crowd predictions.
6. Never downgrade quality of ingredients unless absolutely necessary, and always note any quality compromise in the reasoning.

TASK 1: SUBSTITUTE RANKING FORMAT
If given an ingredient price alert, output JSON with this exact schema:
{
  "recommended_substitute": "String",
  "confidence_score": 0.0 to 1.0,
  "reasoning": "Short 1-sentence explanation focusing on flavor, texture, and yield",
  "estimated_margin_saved_percentage": Number,
  "owner_warning": "Short warning or preparation tip"
  "quality_comprimise" : "Wthin the reasoning please state if the quality is getting comprimised"
}

TASK 2: DAILY NOTE FORMATTING
Format the final Daily Smart Order Note cleanly with headings: Forecast Summary, Margin Watch, Collective Inventory Needs, and Recommended Supplier Order.`
  );
  
  const [knowledgeRules, setKnowledgeRules] = useState<string[]>([
    "Rule 1 (Data Integrity): NEVER invent sales data, ingredient prices, or recipe requirements.",
    "Rule 2 (Structured JSON Output): ALWAYS return structured JSON with required schema keys when evaluating margin risks or substitutions.",
    "Rule 3 (Supplier Readiness): Keep owner notes practical, short, and supplier-ready.",
    "Rule 4 (Margin Threat Watch): Highlight margin threats clearly when an ingredient cost is elevated above normal (e.g. >5% surge).",
    "Task 1 Substitute Schema: Return JSON with { recommended_substitute, confidence_score, reasoning, estimated_margin_saved_percentage, owner_warning }.",
    "Task 2 Note Layout: Organize daily order notes strictly under headings: Forecast Summary, Margin Watch, Collective Inventory Needs, Recommended Supplier Order.",
    "Supplier RAG & Weather Integration: Cross-reference US market directory (Sysco, US Foods, GFS, PFG) and live weather for precise crowd predictions."
  ]);

  const [fewShotExamples, setFewShotExamples] = useState<{ query: string; expectedAnswer: string }[]>([
    {
      query: `Evaluate price alert JSON: {"ingredient_at_risk": "Refined Frying Oil", "normal_price": 2.10, "current_price": 2.65, "price_increase_percentage": 26.2, "candidate_substitutes": [{"name": "Canola Oil", "price_per_gal": 2.15}, {"name": "Vegetable Oil Blend", "price_per_gal": 2.20}]}`,
      expectedAnswer: `{
  "recommended_substitute": "Canola Oil",
  "confidence_score": 0.92,
  "reasoning": "Canola Oil matches high smoke-point frying performance and neutral flavor while lowering oil expenditure.",
  "estimated_margin_saved_percentage": 14.5,
  "owner_warning": "Filter fryers daily to maintain crispiness and maximum oil longevity."
}`
    },
    {
      query: `Format Daily Smart Order Note for Main Street Burger Co. (Target Date: Saturday, June 13) with 115 Burgers forecasted, 40% Flank Steak cost surge, 18lb Potatoes on hand, and 50lb Potato Bag needed.`,
      expectedAnswer: `[RESTOBOT] DAILY SMART ORDER NOTE
Restaurant: Main Street Burger Co.
Target Date: Saturday, June 13

Forecast Summary:
* Base Saturday Demand: 92 burgers
* Stadium Event Nearby: +18 burgers (+15%)
* Local Rain Adjustment: -5 burgers (-4%)
* Owner Manual Adjustment: +10 burgers (+5%)
* Final Projected Demand: 115 Burgers

Margin Watch:
* ALERT: Flank Steak is 40% above normal supplier price ($11.20/lb vs $8.00/lb).
* Recommended Substitute: Skirt Steak ($8.60/lb).
* Estimated Margin Protected: +4.2%

Collective Inventory Needs:
* Skirt Steak: 45 lb
* Brioche Buns: 120 units
* Potatoes: 50 lb
* Refined Frying Oil: 5 gallons
* Salt: 1.2 kg

Recommended Supplier Order:
* Skirt Steak: 45 lb (US Foods)
* Brioche Buns: 96 units (Gordon Food Service)
* Potatoes: 1 x 50 lb bag (GreenValley Produce)
* Refined Frying Oil: 5 gallons (Sysco Wholesale)`
    }
  ]);

  const [newRuleInput, setNewRuleInput] = useState<string>('');
  const [newQueryInput, setNewQueryInput] = useState<string>('');
  const [newAnswerInput, setNewAnswerInput] = useState<string>('');

  const [testUserQuery, setTestUserQuery] = useState<string>(
    "What menu items are suffering the worst profit margin loss due to recent supplier price hikes?"
  );
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [benchmarkOutput, setBenchmarkOutput] = useState<any>(null);

  // Ingestion Test state
  const [sampleCsvInput, setSampleCsvInput] = useState<string>(
    `order_id,date,item_name,category,unit_price,quantity,total_amount,transaction_type,received_by
ORD-901,2026-07-29,Vadapav,Snacks,2.50,12,30.00,Dine In,Counter
ORD-902,2026-07-29,Cheese Garlic Naan,Breads,4.50,8,36.00,Dine In,Counter
ORD-903,2026-07-29,Cheese Pizza,Mains,12.00,5,60.00,Takeaway,Online`
  );
  const [ingestOutput, setIngestOutput] = useState<any>(null);

  // Alerts Test state
  const [alertsOutput, setAlertsOutput] = useState<any>(null);

  // Forecast Test state
  const [horizonDays, setHorizonDays] = useState(7);
  const [safetyBuffer, setSafetyBuffer] = useState(1.2);
  const [forecastOutput, setForecastOutput] = useState<any>(null);

  // Task 1: Substitute Ranking state
  const [task1InputJson, setTask1InputJson] = useState<string>(
    JSON.stringify({
      ingredient_at_risk: "Refined Frying Oil",
      normal_price: 2.10,
      current_price: 2.65,
      price_increase_percentage: 26.2,
      candidate_substitutes: [
        { name: "Canola Oil", price_per_gal: 2.15 },
        { name: "Vegetable Oil Blend", price_per_gal: 2.20 },
        { name: "Sunflower Oil", price_per_gal: 2.45 }
      ]
    }, null, 2)
  );
  const [task1Output, setTask1Output] = useState<any>(null);

  // Task 2: Daily Note Formatter state
  const [task2InputData, setTask2InputData] = useState<{
    restaurantName: string;
    targetDate: string;
    forecastData: any;
    marginData: any;
    inventoryNeeds: string[];
    supplierOrders: string[];
  }>({
    restaurantName: "Main Street Burger Co.",
    targetDate: "Saturday, June 13",
    forecastData: { baseDemand: "92 burgers", weatherImpact: "Stadium Event +18, Rain -5", projectedFootfall: "115 Burgers" },
    marginData: { alertItem: "Flank Steak +40% surge ($11.20/lb vs $8.00/lb)", substitute: "Skirt Steak ($8.60/lb)", marginSaved: "4.2%" },
    inventoryNeeds: ["Skirt Steak: 45 lb", "Brioche Buns: 120 units", "Potatoes: 50 lb", "Refined Frying Oil: 5 gallons"],
    supplierOrders: ["US Foods: 45 lb Skirt Steak", "Gordon Food Service: 96 Brioche Buns", "Sysco: 5 gal Frying Oil"]
  });
  const [task2Output, setTask2Output] = useState<any>(null);

  // CRUD Test state
  const [ingredientsData, setIngredientsData] = useState<any[]>([]);
  const [recipesData, setRecipesData] = useState<any[]>([]);

  // Task 1 execution handler
  const handleRunTask1Substitute = async () => {
    setIsExecuting(true);
    setTask1Output(null);
    try {
      let parsedAlert = {};
      try { parsedAlert = JSON.parse(task1InputJson); } catch (e) { alert("Invalid input JSON format!"); setIsExecuting(false); return; }
      
      const res = await authenticatedFetch('/api/ai/substitute-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceAlert: parsedAlert }),
      });
      const data = await res.json();
      setTask1Output(data);
      addLog('/api/ai/substitute-evaluation', res.status, data);
    } catch (e: any) {
      setTask1Output({ error: e.message });
      addLog('/api/ai/substitute-evaluation', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Task 2 execution handler
  const handleRunTask2NoteFormatter = async () => {
    setIsExecuting(true);
    setTask2Output(null);
    try {
      const res = await authenticatedFetch('/api/ai/format-daily-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task2InputData),
      });
      const data = await res.json();
      setTask2Output(data);
      addLog('/api/ai/format-daily-note', res.status, data);
    } catch (e: any) {
      setTask2Output({ error: e.message });
      addLog('/api/ai/format-daily-note', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Log helper
  const addLog = (endpoint: string, status: number, payload: any) => {
    setApiLog(prev => [
      { time: new Date().toLocaleTimeString(), endpoint, status, payload },
      ...prev.slice(0, 20),
    ]);
  };

  // Run Health Check
  const fetchHealth = async () => {
    try {
      const res = await authenticatedFetch('/api/health');
      const data = await res.json();
      setHealthData(data);
      addLog('/api/health', res.status, data);
    } catch (e: any) {
      addLog('/api/health', 500, { error: e.message });
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Train AI System Prompt & Knowledge Set
  const handleTrainModel = async () => {
    setIsExecuting(true);
    try {
      const res = await authenticatedFetch('/api/ai/train-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          systemPrompt,
          knowledgeRules,
          fewShotExamples
        }),
      });
      const data = await res.json();
      addLog('/api/ai/train-prompt', res.status, data);
      alert(`Model successfully trained with ${data.knowledgeRulesCount} knowledge rules and ${data.fewShotExamplesCount} few-shot pairs!`);
    } catch (e: any) {
      addLog('/api/ai/train-prompt', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Execute Benchmark Evaluation Suite
  const handleRunBenchmark = async () => {
    setIsExecuting(true);
    setBenchmarkOutput(null);
    try {
      const res = await authenticatedFetch('/api/ai/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setBenchmarkOutput(data);
      addLog('/api/ai/benchmark', res.status, data);
    } catch (e: any) {
      setBenchmarkOutput({ error: e.message });
      addLog('/api/ai/benchmark', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test AI Reasoning
  const handleRunAiAdvisor = async () => {
    setIsExecuting(true);
    setAiOutput(null);
    try {
      const res = await authenticatedFetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testUserQuery }),
      });
      const data = await res.json();
      setAiOutput(data);
      addLog('/api/ai/advisor', res.status, data);
    } catch (e: any) {
      setAiOutput({ error: e.message });
      addLog('/api/ai/advisor', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test Sales Ingestion Engine
  const handleRunIngestion = async () => {
    setIsExecuting(true);
    setIngestOutput(null);
    try {
      const res = await authenticatedFetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: sampleCsvInput, restaurantId: 'rest_001' }),
      });
      const data = await res.json();
      setIngestOutput(data);
      addLog('/api/ingest', res.status, data);
    } catch (e: any) {
      setIngestOutput({ error: e.message });
      addLog('/api/ingest', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test Supplier Price Creep Alerts
  const handleRunAlerts = async () => {
    setIsExecuting(true);
    setAlertsOutput(null);
    try {
      const res = await authenticatedFetch('/api/alerts');
      const data = await res.json();
      setAlertsOutput(data);
      addLog('/api/alerts', res.status, data);
    } catch (e: any) {
      setAlertsOutput({ error: e.message });
      addLog('/api/alerts', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test Purchase Order Forecast Engine
  const handleRunForecast = async () => {
    setIsExecuting(true);
    setForecastOutput(null);
    try {
      const res = await authenticatedFetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizonDays, safetyBuffer }),
      });
      const data = await res.json();
      setForecastOutput(data);
      addLog('/api/forecast', res.status, data);
    } catch (e: any) {
      setForecastOutput({ error: e.message });
      addLog('/api/forecast', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test Fetching Ingredients & Recipes
  const handleFetchCrud = async () => {
    setIsExecuting(true);
    try {
      const resIng = await authenticatedFetch('/api/ingredients');
      const dataIng = await resIng.json();
      const ingredients = Array.isArray(dataIng) ? dataIng : (dataIng.data || []);
      setIngredientsData(ingredients);
      addLog('/api/ingredients', resIng.status, { count: ingredients.length });

      const resRec = await authenticatedFetch('/api/recipes');
      const dataRec = await resRec.json();
      const recipes = Array.isArray(dataRec) ? dataRec : (dataRec.data || []);
      setRecipesData(recipes);
      addLog('/api/recipes', resRec.status, { count: recipes.length });
    } catch (e: any) {
      addLog('/api/crud', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test Supplier RAG Vector Search
  const handleRunSupplierRag = async () => {
    setIsExecuting(true);
    setRagOutput(null);
    try {
      const res = await authenticatedFetch('/api/suppliers/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ragQueryInput, currentPrice: ragPriceInput }),
      });
      const data = await res.json();
      setRagOutput(data);
      addLog('/api/suppliers/rag-search', res.status, data);
    } catch (e: any) {
      setRagOutput({ error: e.message });
      addLog('/api/suppliers/rag-search', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test Weather, Traffic & Event Predictive Forecasting
  const handleRunWeatherEventsForecast = async () => {
    setIsExecuting(true);
    setWeatherOutput(null);
    try {
      const res = await authenticatedFetch('/api/forecast/weather-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: weatherLocation,
          tempFahrenheit: weatherTemp,
          weatherCondition: weatherCondition,
          eventTraffic: eventTraffic,
          useLiveWeather: useLiveWeather,
          dayOfWeek: 'Saturday',
          baseCustomerCount: 200
        }),
      });
      const data = await res.json();
      setWeatherOutput(data);
      addLog('/api/forecast/weather-events', res.status, data);
    } catch (e: any) {
      setWeatherOutput({ error: e.message });
      addLog('/api/forecast/weather-events', 500, { error: e.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Handlers for adding/deleting rules & examples
  const handleAddRule = () => {
    if (newRuleInput.trim()) {
      setKnowledgeRules(prev => [...prev, newRuleInput.trim()]);
      setNewRuleInput('');
    }
  };

  const handleRemoveRule = (index: number) => {
    setKnowledgeRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddExample = () => {
    if (newQueryInput.trim() && newAnswerInput.trim()) {
      setFewShotExamples(prev => [...prev, { query: newQueryInput.trim(), expectedAnswer: newAnswerInput.trim() }]);
      setNewQueryInput('');
      setNewAnswerInput('');
    }
  };

  const handleRemoveExample = (index: number) => {
    setFewShotExamples(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      
      {/* Console Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>AI Configuration & REST API Testing Workbench</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-3">
            <span>Rinet Resto Bot Training Console</span>
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">
              Model Training Mode Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans">
            Configure assistant instructions, define restaurant business rules, add reviewed examples, execute evaluation benchmarks, and test backend REST APIs.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center space-x-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${isExecuting ? 'animate-spin' : ''}`} />
          <span>Ping /api/health</span>
        </button>
      </div>

      {/* Account Onboarding & PIN-Protected Setup Bar */}
      <AccountSetupBar onAccountTrained={(data) => {
        if (data?.customPrompt) {
          setSystemPrompt(data.customPrompt);
        }
      }} />

      {/* TABS NAVIGATION */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
        <button
          onClick={() => setActiveTab('ai_model')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'ai_model'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>1. AI Model Training & Benchmarking</span>
        </button>

        <button
          onClick={() => setActiveTab('task1_substitute')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'task1_substitute'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Task 1: Substitute JSON Evaluator</span>
        </button>

        <button
          onClick={() => setActiveTab('task2_daily_note')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'task2_daily_note'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>Task 2: Daily Order Note Formatter</span>
        </button>

        <button
          onClick={() => setActiveTab('rag_suppliers')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'rag_suppliers'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>2. AI Supplier RAG Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('weather_events')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'weather_events'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 text-sky-400" />
          <span>3. Weather & Traffic Predictor</span>
        </button>

        <button
          onClick={() => setActiveTab('ingestion')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'ingestion'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>4. Sales Ingestion Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'alerts'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>5. Price Creep Detector</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'forecast'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>6. Purchase Order Forecast</span>
        </button>

        <button
          onClick={() => setActiveTab('crud')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'crud'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>7. Database CRUD Tables</span>
        </button>
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Work Area (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: AI MODEL TRAINING & PROMPT TUNING */}
          {activeTab === 'ai_model' && (
            <div className="space-y-6">
              
              {/* System Instructions Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span>Assistant Persona & Instructions</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Define the core role, tone, and financial advice priorities for the AI model.
                    </p>
                  </div>
                  <button
                    onClick={handleTrainModel}
                    disabled={isExecuting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center space-x-2 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Train & Commit Model Config</span>
                  </button>
                </div>

                <div>
                  <textarea
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Trained Knowledge Rules Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Trained Domain Knowledge Rules ({knowledgeRules.length})</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Injected into model prompt context</span>
                </div>

                <div className="space-y-2">
                  {knowledgeRules.map((rule, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-200">
                      <span>• {rule}</span>
                      <button
                        onClick={() => handleRemoveRule(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add new rule (e.g. Always keep dairy stock usage under 5 days)"
                    value={newRuleInput}
                    onChange={(e) => setNewRuleInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleAddRule}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Rule</span>
                  </button>
                </div>
              </div>

              {/* Few-Shot Q&A Training Examples Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    <span>Few-Shot Q&A Training Pairs ({fewShotExamples.length})</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Teaches desired answer style & reasoning format</span>
                </div>

                <div className="space-y-3">
                  {fewShotExamples.map((ex, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-amber-300">
                        <span>Q: {ex.query}</span>
                        <button
                          onClick={() => handleRemoveExample(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-slate-300 whitespace-pre-wrap text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800">
                        {ex.expectedAnswer}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    placeholder="User question (e.g. How do I reduce waste on tomatoes?)"
                    value={newQueryInput}
                    onChange={(e) => setNewQueryInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <textarea
                    rows={2}
                    placeholder="Expected expert answer..."
                    value={newAnswerInput}
                    onChange={(e) => setNewAnswerInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleAddExample}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Training Pair</span>
                  </button>
                </div>
              </div>

              {/* Live Testing & Automated Benchmark Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Gauge className="w-4 h-4 text-amber-400" />
                      <span>Live Testing & Benchmark Evaluation</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Verify trained model performance with real user questions or run automated benchmarks.
                    </p>
                  </div>

                  <button
                    onClick={handleRunBenchmark}
                    disabled={isExecuting}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center space-x-2 shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Automated Benchmark Suite</span>
                  </button>
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={testUserQuery}
                    onChange={(e) => setTestUserQuery(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleRunAiAdvisor}
                    disabled={isExecuting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow transition flex items-center space-x-2 shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test Query /api/ai/advisor</span>
                  </button>
                </div>

                {/* AI Output Inspection */}
                {aiOutput && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-xs text-emerald-400 font-bold flex items-center justify-between">
                      <span>Assistant Reply</span>
                      <span className="text-slate-500 text-[10px]">Trained Rules Applied: {aiOutput.rulesCount || knowledgeRules.length}</span>
                    </div>
                    <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      {JSON.stringify(aiOutput, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Benchmark Output Inspection */}
                {benchmarkOutput && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-xs text-amber-400 font-bold flex items-center justify-between">
                      <span>Benchmark Results ({benchmarkOutput.totalQueriesTested} Test Queries Evaluated)</span>
                      <span className="text-emerald-400 text-[10px]">Avg Latency: {benchmarkOutput.avgLatencyMs}ms</span>
                    </div>
                    <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      {JSON.stringify(benchmarkOutput, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TASK 1: SUBSTITUTE RANKING JSON EVALUATOR */}
          {activeTab === 'task1_substitute' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-amber-400" />
                    <span>TASK 1: RestoBot AI Substitute Ranking JSON Evaluator</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Evaluates ingredient price alerts and outputs JSON matching schema: recommended_substitute, confidence_score, reasoning, estimated_margin_saved_percentage, owner_warning.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Input Price Alert JSON:</label>
                <textarea
                  value={task1InputJson}
                  onChange={(e) => setTask1InputJson(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-sky-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleRunTask1Substitute}
                disabled={isExecuting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Execute Task 1 Evaluation /api/ai/substitute-evaluation</span>
              </button>

              {task1Output && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-bold text-emerald-400">Structured Task 1 JSON Output:</span>
                  <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap bg-slate-900/80 p-3 rounded-lg border border-slate-800 max-h-72 overflow-y-auto">
                    {JSON.stringify(task1Output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TASK 2: DAILY SMART ORDER NOTE FORMATTER */}
          {activeTab === 'task2_daily_note' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    <span>TASK 2: RestoBot AI Daily Smart Order Note Formatter</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Formats daily order notes cleanly with headings: Forecast Summary, Margin Watch, Collective Inventory Needs, and Recommended Supplier Order.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300">Restaurant Name:</label>
                  <input
                    type="text"
                    value={task2InputData.restaurantName}
                    onChange={(e) => setTask2InputData({ ...task2InputData, restaurantName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300">Target Date:</label>
                  <input
                    type="text"
                    value={task2InputData.targetDate}
                    onChange={(e) => setTask2InputData({ ...task2InputData, targetDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleRunTask2NoteFormatter}
                disabled={isExecuting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Format Daily Order Note /api/ai/format-daily-note</span>
              </button>

              {task2Output && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-bold text-emerald-400">Formatted Task 2 Supplier-Ready Note:</span>
                  <pre className="text-xs text-slate-100 font-sans whitespace-pre-wrap bg-slate-900/80 p-4 rounded-lg border border-slate-800 max-h-96 overflow-y-auto leading-relaxed">
                    {task2Output.formattedNote || JSON.stringify(task2Output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI SUPPLIER RAG SEARCH ENGINE */}
          {activeTab === 'rag_suppliers' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                    <span>AI Supplier RAG Vector Search Engine</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Search the verified market supplier directory to find better quality and lower-priced vendor options.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Ingredient / Product Query:</label>
                  <input
                    type="text"
                    value={ragQueryInput}
                    onChange={(e) => setRagQueryInput(e.target.value)}
                    placeholder="e.g. Refined Frying Oil, Cheese, Chicken"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Current Rate ($/unit):</label>
                  <input
                    type="number"
                    step="0.10"
                    value={ragPriceInput}
                    onChange={(e) => setRagPriceInput(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleRunSupplierRag}
                disabled={isExecuting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute RAG Search /api/suppliers/rag-search</span>
              </button>

              {ragOutput && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">
                      Found {ragOutput.totalMatchesFound} Matched Verified Suppliers
                    </span>
                    <span className="text-[10px] text-slate-500">Directory Size: {ragOutput.directorySize} vendors</span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {ragOutput.matchedSuppliers?.map((m: any, idx: number) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-100">
                          <span className="text-amber-400">{m.supplier.name}</span>
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                            Rate: ${m.offeredUnitPrice.toFixed(2)} / {m.unitType}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                          <span>Rating: {m.supplier.qualityRating}/5 ⭐</span>
                          <span>Lead: {m.supplier.deliveryLeadTimeDays} day(s)</span>
                          <span>Min Order: ${m.supplier.minOrderValue}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Certifications: {m.supplier.certifications.join(', ')} | Contact: {m.supplier.contactEmail}
                        </div>
                        {m.priceSavingsPercentage > 0 && (
                          <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-1 rounded">
                            💰 Saves {m.priceSavingsPercentage}% compared to current ${ragPriceInput.toFixed(2)} rate!
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <pre className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto">
                    {JSON.stringify(ragOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WEATHER & TRAFFIC CROWD PREDICTOR */}
          {activeTab === 'weather_events' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-sky-400" />
                    <span>Predictive Weather, Traffic & Event Crowd Engine</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    PRD Pillars 2 & 5: Adjusts predicted customer footfall and category demand based on weather conditions and local events.
                  </p>
                </div>

                <button
                  onClick={() => setUseLiveWeather(!useLiveWeather)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 border ${
                    useLiveWeather
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <span>🌐 Live Open-Meteo Weather API: {useLiveWeather ? 'ENABLED' : 'OFF (Manual)'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-300">US City / Zip Code Location:</label>
                    <div className="flex space-x-1">
                      {['Austin', 'New York', 'Chicago', 'Miami', 'Los Angeles'].map(city => (
                        <button
                          key={city}
                          onClick={() => setWeatherLocation(`${city}, US`)}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded"
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={weatherLocation}
                    onChange={(e) => setWeatherLocation(e.target.value)}
                    placeholder="e.g. Austin, New York, Chicago, 78701"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Fallback Temp (°F):</label>
                    <input
                      type="number"
                      value={weatherTemp}
                      onChange={(e) => setWeatherTemp(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Fallback Condition:</label>
                    <select
                      value={weatherCondition}
                      onChange={(e) => setWeatherCondition(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Sunny/Hot">Sunny / Hot (&gt;85°F)</option>
                      <option value="Cold/Snow">Cold / Snow (&lt;45°F)</option>
                      <option value="Rainy/Storm">Rainy / Heavy Storm</option>
                      <option value="Mild/Clear">Mild / Clear (70°F)</option>
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Local Event / Traffic Factors:</label>
                  <select
                    value={eventTraffic}
                    onChange={(e) => setEventTraffic(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Stadium Concert nearby (+20% crowd)">Stadium Concert nearby (+22% footfall surge)</option>
                    <option value="Major Sports Game Day (+28% fan crowd)">Major Sports Game Day (+28% fan surge)</option>
                    <option value="Downtown Street Festival (+18% crowd)">Downtown Street Festival (+18% crowd)</option>
                    <option value="Normal Traffic (0%)">Normal Neighborhood Traffic (0%)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleRunWeatherEventsForecast}
                disabled={isExecuting}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Fetch Weather & Calculate Forecast /api/forecast/weather-events</span>
              </button>

              {weatherOutput && (
                <div className="space-y-3 pt-2">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-400">
                        Predicted Footfall: {weatherOutput.projectedCustomers} Customers
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded">
                        Net Traffic Modifier: {weatherOutput.netTrafficModifierPercentage > 0 ? '+' : ''}{weatherOutput.netTrafficModifierPercentage}%
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      {weatherOutput.explanations?.map((exp: string, idx: number) => (
                        <p key={idx} className="flex items-center space-x-1.5 text-slate-300">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{exp}</span>
                        </p>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-amber-400">Seasonal Category Shifts:</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                        {Object.entries(weatherOutput.categoryDemandAdjustments || {}).map(([cat, adj]: any) => (
                          <div key={cat} className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between text-xs">
                            <span className="text-slate-300">{cat}</span>
                            <span className={`font-bold ${adj > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {adj > 0 ? `+${adj}%` : `${adj}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <pre className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto">
                    {JSON.stringify(weatherOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          {activeTab === 'ingestion' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>POS Sales Ingestion & BOM Deduction Algorithm</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Tests PapaParse CSV mapping and recipe portion deduction from inventory.
                  </p>
                </div>
                <button
                  onClick={handleRunIngestion}
                  disabled={isExecuting}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl shadow transition flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute /api/ingest</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Raw CSV Text Input</label>
                <textarea
                  rows={5}
                  value={sampleCsvInput}
                  onChange={(e) => setSampleCsvInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {ingestOutput && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs text-amber-400 font-bold">
                    Ingestion Execution Result (Parsed: {ingestOutput.parsedCount} records)
                  </div>
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    {JSON.stringify(ingestOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRICE CREEP ALERTS */}
          {activeTab === 'alerts' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <span>Supplier Price Creep & Margin Loss Detector</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Analyzes raw stock rates vs previous baseline to identify overcharges.
                  </p>
                </div>
                <button
                  onClick={handleRunAlerts}
                  disabled={isExecuting}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow transition flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute /api/alerts</span>
                </button>
              </div>

              {alertsOutput && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs text-rose-400 font-bold">
                    Alerts Output (Total Monthly Profit Impact: ${alertsOutput.totalLoss?.toFixed(2)})
                  </div>
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    {JSON.stringify(alertsOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FORECAST ENGINE */}
          {activeTab === 'forecast' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-teal-400" />
                    <span>Purchase Order Demand Forecasting Engine</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Calculates ingredient order requirements based on sales velocity and buffer.
                  </p>
                </div>
                <button
                  onClick={handleRunForecast}
                  disabled={isExecuting}
                  className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl shadow transition flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute /api/forecast</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Horizon Days ({horizonDays})</label>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={horizonDays}
                    onChange={(e) => setHorizonDays(Number(e.target.value))}
                    className="w-full accent-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Safety Buffer ({safetyBuffer}x)</label>
                  <input
                    type="range"
                    min="1.0"
                    max="1.5"
                    step="0.05"
                    value={safetyBuffer}
                    onChange={(e) => setSafetyBuffer(Number(e.target.value))}
                    className="w-full accent-teal-500"
                  />
                </div>
              </div>

              {forecastOutput && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs text-teal-400 font-bold">
                    Forecast PO Output (Total Sales Projected: ${forecastOutput.totalProjectedSalesValue?.toFixed(2)})
                  </div>
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    {JSON.stringify(forecastOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CRUD TABLES */}
          {activeTab === 'crud' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    <span>Database Table Records Query</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Query raw stock ingredients and dish menu recipes from the server store.
                  </p>
                </div>
                <button
                  onClick={handleFetchCrud}
                  disabled={isExecuting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow transition flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Fetch /api/ingredients & /api/recipes</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-indigo-300 font-bold">Ingredients ({ingredientsData.length})</div>
                  <div className="text-[11px] text-slate-400 max-h-40 overflow-y-auto">
                    {ingredientsData.map((i, idx) => (
                      <div key={idx}>• {i.name}: {i.current_stock} {i.unit} (${i.cost_per_unit})</div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-indigo-300 font-bold">Menu Items ({recipesData.length})</div>
                  <div className="text-[11px] text-slate-400 max-h-40 overflow-y-auto">
                    {recipesData.map((m, idx) => (
                      <div key={idx}>• {m.name}: ${m.selling_price} ({m.recipes?.length || 0} ingredients)</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: Health Status & Live API Console Logs */}
        <div className="space-y-6">
          
          {/* Server Health Status Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Server Runtime Environment</span>
            </h3>

            {healthData ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-emerald-400 font-bold">{healthData.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">AI service:</span>
                  <span className={healthData.aiConfigured ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {healthData.aiConfigured ? "Configured" : "Unavailable"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Supabase DB:</span>
                  <span className={healthData.supabaseConfigured ? "text-emerald-400 font-bold" : "text-slate-500 font-bold"}>
                    {healthData.supabaseConfigured ? "Connected" : "In-Memory Sync"}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>Sales Records: {healthData.metrics?.totalSalesRecords}</div>
                  <div>Ingredients: {healthData.metrics?.totalIngredients}</div>
                  <div>Menu Recipes: {healthData.metrics?.totalMenuItems}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Checking server health...</div>
            )}
          </div>

          {/* Live API Console Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>API Execution Stream</span>
              <span className="text-[10px] text-slate-500">{apiLog.length} calls</span>
            </h3>

            <div className="space-y-2 max-h-80 overflow-y-auto text-[11px]">
              {apiLog.length === 0 ? (
                <div className="text-slate-500 text-center py-6">No API calls recorded yet. Click any button to test.</div>
              ) : (
                apiLog.map((log, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">{log.endpoint}</span>
                      <span className="text-emerald-400 font-mono">{log.status}</span>
                    </div>
                    <div className="text-slate-500 text-[10px] flex items-center justify-between">
                      <span>{log.time}</span>
                      <span className="truncate max-w-[140px]">{JSON.stringify(log.payload)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
