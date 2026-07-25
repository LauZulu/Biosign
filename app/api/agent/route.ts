import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const gesturePromptMap: Record<string, { agentName: string; promptRole: string; description: string }> = {
  EDUCATOR: {
    agentName: 'Educator Agent',
    promptRole: 'Explain what this protein is, in simple accessible language anyone can understand. 3-4 sentences.',
    description: 'Explain the selected protein in simple, accessible English for a beginner. Cover what it is, its role in the disease, and why it is fascinating. Keep it concise and natural.',
  },
  ONE: {
    agentName: 'Research Agent',
    promptRole: 'Summarize what scientific research and literature reveal about this protein: key discoveries, its role in disease research, and why researchers study it. Synthesize known findings from your knowledge. 3-4 sentences.',
    description: 'Summarize what scientific research and literature reveal about the selected protein: key discoveries, its role in disease research, and why researchers study it. Synthesize known findings from your knowledge. 3-4 sentences.',
  },
  TWO: {
    agentName: 'Orchestration (multi-agent)',
    promptRole: 'Run a 3-step orchestration in a single structured response: (a) a Structure sub-agent describes the protein\'s structure, (b) a Disease sub-agent explains its link to the disease, (c) a Therapy sub-agent notes therapeutic angles. Then a Synthesizer combines them into one integrated insight. Return each step clearly labeled so the orchestration is visible in the panel.',
    description: 'Run a 3-step orchestration for the selected protein: (a) Structure sub-agent describes the protein\'s structure, (b) Disease sub-agent explains how it links to the disease, (c) Therapy sub-agent notes therapeutic angles. Then a Synthesizer combines them into one integrated insight. Return each step clearly labeled.',
  },
  THREE: {
    agentName: 'Curiosity Agent',
    promptRole: 'Share one fascinating, surprising "did you know" fact about this protein that sparks curiosity. 2-3 sentences, engaging.',
    description: 'Share one fascinating, surprising did you know fact about the selected protein that sparks curiosity. 2-3 sentences, engaging.',
  },
  THUMBS_UP: {
    agentName: 'Frontier Agent',
    promptRole: 'Describe what scientists are researching RIGHT NOW about this protein and the future hope/therapeutic directions. 3-4 sentences, inspiring.',
    description: 'Describe what scientists are researching right now about the selected protein and the future hope or therapeutic directions. 3-4 sentences, inspiring.',
  },
  FIST: {
    agentName: 'Biologist Agent',
    promptRole: 'Give a short technical structural analysis of this protein (domains, folds, key features). 3-4 sentences.',
    description: 'Give a short technical structural analysis of the selected protein: domains, folds, key features. 3-4 sentences.',
  },
};

const extractTextContent = (message: any) => {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
      .map((block: any) => block.text)
      .join('\n')
      .trim();
  }
  return '';
};

const normalizeGesture = (gesture: string) => {
  const normalized = gesture.trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'OPEN_HAND' || normalized === 'OPEN' || normalized === 'EDUCATOR' || normalized === 'EDUCATOR_AGENT') {
    return 'EDUCATOR';
  }
  return normalized;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const gesture = normalizeGesture(String(body?.gesture || ''));
    const protein = String(body?.protein || 'TP53');
    const pdbId = String(body?.pdbId || 'unknown');
    const language = String(body?.language || 'ES').toUpperCase() === 'EN' ? 'EN' : 'ES';

    const languageInstruction = language === 'ES' ? 'Responde en español.' : 'Respond in English.';
    const languageName = language === 'ES' ? 'Spanish' : 'English';

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY environment variable.' }, { status: 500 });
    }

    const gestureConfig = gesturePromptMap[gesture];
    if (!gestureConfig) {
      return NextResponse.json({ error: 'Unsupported gesture for agent execution.' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const sendAgentPrompt = async (agentLabel: string, taskText: string) => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: 'You are a biology-focused assistant. Answer in clear English for a beginner, using the role-specific instructions provided by the user. Be honest about uncertainty: if a claim is not well established, qualify it with phrases like "research suggests" or "it appears". Do not invent specific study names, citations, or exact numbers unless they are widely known facts.',
        messages: [
          {
            role: 'user',
            content: `Agent: ${gestureConfig.agentName}\nProtein: ${protein}\nPDB ID: ${pdbId}\nStep: ${agentLabel}\nTask: ${taskText}\n\nWhen you are uncertain, clearly say so and avoid making up specific citations or study details.`,
          },
        ],
      });
      return extractTextContent(response);
    };

    if (gesture === 'TWO') {
      const structureOutput = await sendAgentPrompt(
        'Structure Agent',
        'Analyze the protein structure and describe its key structural features, domains, folds, and functional elements relevant to its biology. Keep the answer clear and concise.'
      );

      const diseaseOutput = await sendAgentPrompt(
        'Disease Agent',
        `Using the structure information below, explain how these structural features relate to the disease mechanism and biological relevance.\n\nStructure output:\n${structureOutput}`
      );

      const therapyOutput = await sendAgentPrompt(
        'Therapy Agent',
        `Using the disease mechanism below, propose plausible therapeutic angles or research directions that follow from those structural and disease insights.\n\nDisease output:\n${diseaseOutput}`
      );

      const finalOutput = await sendAgentPrompt(
        'Synthesizer Agent',
        `Integrate the outputs of the Structure, Disease, and Therapy agents into one coherent insight. Mention how structure informs disease understanding and how that suggests therapeutic directions.\n\nStructure output:\n${structureOutput}\n\nDisease output:\n${diseaseOutput}\n\nTherapy output:\n${therapyOutput}`
      );

      return NextResponse.json({
        agent: gestureConfig.agentName,
        answer: finalOutput,
        orchestration: [
          { label: 'Structure', output: structureOutput },
          { label: 'Disease', output: diseaseOutput },
          { label: 'Therapy', output: therapyOutput },
        ],
      });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: 'You are a biology-focused assistant. Answer in clear English for a beginner, using the role-specific instructions provided by the user. Be honest about uncertainty: if a claim is not well established, qualify it with phrases like "research suggests" or "it appears". Do not invent specific study names, citations, or exact numbers unless they are widely known facts.',
      messages: [
        {
          role: 'user',
          content: `Agent: ${gestureConfig.agentName}\nProtein: ${protein}\nPDB ID: ${pdbId}\nTask: ${gestureConfig.description}\n\nWhen you are uncertain, clearly say so and avoid making up specific citations or study details.`,
        },
      ],
    });

    const answer = extractTextContent(response);
    return NextResponse.json({ agent: gestureConfig.agentName, answer });
  } catch (error) {
    console.error('Agent route error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error in agent route.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
