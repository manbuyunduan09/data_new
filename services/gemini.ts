
import { GoogleGenAI } from "@google/genai";

export const getChartInsights = async (chartTitle: string, dataSummary: string, descType: string = 'trend') => {
  const prompts = {
    trend: '分析指标随时间的趋势与波动特征。',
    structure: '分析各维度对指标的结构性贡献与权重。',
    ranking: '对各维度表现进行排名解读与贡献度分析。',
    funnel: '解读转化过程中的流失情况与关键漏斗节点。'
  };

  try {
    // Create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      // Use gemini-3-pro-preview for complex reasoning and data analysis tasks.
      model: 'gemini-3-pro-preview',
      contents: `请针对图表 "${chartTitle}" 进行解读。分析重点：${prompts[descType as keyof typeof prompts] || prompts.trend}。数据参考: ${dataSummary}`,
      config: {
        // Move the persona and stylistic requirements to the systemInstruction field.
        systemInstruction: "你是一位赛博朋克未来的高级业务数据专家。请使用中文，限制在 3 条简明扼要的要点，语气专业且果断。",
        temperature: 0.7,
        topP: 0.9,
      }
    });

    // Directly access the .text property from the response object.
    return response.text || "神经元网络未返回分析。";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "连接智能层时出错。";
  }
};
