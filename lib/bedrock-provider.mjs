const prompts = {
	mpx: 'Je bent de digitale adviseur van MPX Studio in Nederland. MPX Studio levert premium maatwerkwebsites, branding, development en AI-automatisering. Spreek Nederlands, wees kort, warm en professioneel. Geef geen ongefundeerde claims en vraag bij serieuze interesse naar doel, doelgroep en contactgegevens.'
};

export async function callBedrock(messages, brand = 'mpx') {
	const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
	const modelId = process.env.BEDROCK_MODEL_ID;
	if (!region || !modelId) return null;

	const [{ BedrockRuntimeClient, ConverseCommand }, agentRuntime] = await Promise.all([
		import('@aws-sdk/client-bedrock-runtime'),
		process.env.BEDROCK_KNOWLEDGE_BASE_ID_MPX ? import('@aws-sdk/client-bedrock-agent-runtime') : Promise.resolve(null)
	]);
	let context = '';
	if (agentRuntime) {
		const { BedrockAgentRuntimeClient, RetrieveCommand } = agentRuntime;
		const query = messages.filter(message => message.role === 'user').at(-1)?.content || '';
		const result = await new BedrockAgentRuntimeClient({ region }).send(new RetrieveCommand({ knowledgeBaseId: process.env.BEDROCK_KNOWLEDGE_BASE_ID_MPX, retrievalQuery: { text: query }, retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 4 } } }));
		context = (result.retrievalResults || []).map(item => item.content?.text || '').filter(Boolean).join('\n\n').slice(0, 12000);
	}
	const client = new BedrockRuntimeClient({ region });
	const response = await client.send(new ConverseCommand({ modelId, system: [{ text: [prompts[brand] || prompts.mpx, context ? `KENNISCONTEXT:\n${context}` : 'Gebruik alleen verifieerbare informatie uit deze instructies.'].join('\n\n') }], messages: messages.map(message => ({ role: message.role, content: [{ text: message.content }] })), inferenceConfig: { maxTokens: 350, temperature: 0.4 } }));
	return response.output?.message?.content?.map(item => item.text || '').join('').trim() || null;
}

export function bedrockEnabled() {
	return Boolean((process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) && process.env.BEDROCK_MODEL_ID);
}
