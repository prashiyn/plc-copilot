export interface DocArticleMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  updated: string;
  popular: boolean;
}

export const DOC_ARTICLES: DocArticleMeta[] = [
  {
    slug: 'quick-start',
    title: 'Quick Start Guide',
    description: 'Get up and running with PLCAutoPilot in minutes.',
    category: 'getting-started',
    readTime: '5 min',
    updated: '2026-02-10',
    popular: true,
  },
  {
    slug: 'iec-61131-3',
    title: 'Understanding IEC 61131-3 Standards',
    description: 'Overview of ladder logic, structured text, and function blocks.',
    category: 'getting-started',
    readTime: '12 min',
    updated: '2026-02-05',
    popular: true,
  },
  {
    slug: 'siemens-tia-portal',
    title: 'Siemens TIA Portal Integration',
    description: 'Export SCL and PLCopen XML for Siemens S7-1200 and S7-1500.',
    category: 'plc-platforms',
    readTime: '18 min',
    updated: '2026-02-12',
    popular: true,
  },
  {
    slug: 'rockwell-studio-5000',
    title: 'Rockwell Studio 5000 Setup',
    description: 'Generate ladder-oriented exports for ControlLogix projects.',
    category: 'plc-platforms',
    readTime: '15 min',
    updated: '2026-02-08',
    popular: false,
  },
  {
    slug: 'ai-code-generation',
    title: 'AI Code Generation Basics',
    description: 'Describe logic in natural language and export vendor artifacts.',
    category: 'ai-features',
    readTime: '10 min',
    updated: '2026-02-09',
    popular: true,
  },
  {
    slug: 'rest-api-overview',
    title: 'REST API Overview',
    description: 'How the Next.js BFF talks to the FastAPI automation service.',
    category: 'api',
    readTime: '8 min',
    updated: '2026-02-13',
    popular: true,
  },
  {
    slug: 'common-errors',
    title: 'Common Error Messages',
    description: 'Troubleshoot generation, export, and authentication issues.',
    category: 'troubleshooting',
    readTime: '6 min',
    updated: '2026-02-11',
    popular: true,
  },
];

export const DOC_CATEGORIES = [
  { id: 'all', name: 'All Documentation' },
  { id: 'getting-started', name: 'Getting Started' },
  { id: 'plc-platforms', name: 'PLC Platforms' },
  { id: 'ai-features', name: 'AI Features' },
  { id: 'api', name: 'API Reference' },
  { id: 'troubleshooting', name: 'Troubleshooting' },
];

export interface TutorialMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  instructor: string;
}

export const TUTORIAL_ARTICLES: TutorialMeta[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started with PLCAutoPilot',
    description: 'Complete beginner guide to your first PLC program.',
    category: 'getting-started',
    difficulty: 'beginner',
    duration: '12:34',
    instructor: 'Sarah Johnson',
  },
  {
    slug: 'siemens-advanced',
    title: 'Siemens S7-1500 Advanced Programming',
    description: 'Tier-2 SCL export workflow and import tips.',
    category: 'plc-platforms',
    difficulty: 'advanced',
    duration: '28:15',
    instructor: 'Michael Chen',
  },
  {
    slug: 'ai-prompting',
    title: 'AI Prompting for Better Code Generation',
    description: 'Write descriptions that map cleanly to IR patterns.',
    category: 'ai-features',
    difficulty: 'intermediate',
    duration: '18:42',
    instructor: 'David Brown',
  },
  {
    slug: 'motor-control-rockwell',
    title: 'Motor Control with Rockwell ControlLogix',
    description: 'Build motor start-stop programs for Allen-Bradley PLCs.',
    category: 'plc-platforms',
    difficulty: 'intermediate',
    duration: '22:18',
    instructor: 'Sarah Johnson',
  },
  {
    slug: 'api-integration',
    title: 'API Integration Fundamentals',
    description: 'Connect PLCAutoPilot to your existing systems.',
    category: 'api',
    difficulty: 'advanced',
    duration: '25:50',
    instructor: 'Michael Chen',
  },
];
