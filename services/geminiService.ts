
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { EbookProject, EbookStructure } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getAudienceLabel = (audience: string) => {
  switch(audience) {
    case 'Novice': return '入门新手（零基础或基础薄弱）';
    case 'Intermediate': return '中级工程师（已有一定开发经验）';
    case 'Expert': return '高级专家（追求深度与底层架构）';
    default: return audience;
  }
};

export const generateEbookStructure = async (project: EbookProject): Promise<EbookStructure> => {
  const ai = getAI();
  
  const languageInstruction = project.outputLanguage === 'Chinese' 
    ? "输出必须使用简体中文。" 
    : "The output MUST be in English.";

  const prompt = `
    作为一名资深技术文档专家和图书策划，请根据以下要求规划内容大纲：
    - 主题描述与目标：${project.description}
    - 目标读者：${getAudienceLabel(project.targetAudience)}
    - 输出语言：${languageInstruction}
    - 写作风格：${project.writingStyle} (调性：${getStyleDescription(project.writingStyle)})
    - 示例代码语言：${project.language}
    - 目标章节数：${project.chapterCount}
    - 背景参考资料：${project.materials}
    - 扩展参考链接：${project.referenceLinks.join(', ')}

    规划要求：
    1. 一个吸引读者的专业 ${project.outputLanguage} 书名。
    2. 循序渐进的内容目录（TOC），包括前言、正文章节和附录。
    3. 每个章节的核心知识点编排（要点形式），难度需完全适配“${getAudienceLabel(project.targetAudience)}”。
    4. 为封面设计提供一个 AI 图像生成提示词（体现技术感、简洁、现代）。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["title", "description"]
              }
            },
            coverPrompt: { type: Type.STRING }
          },
          required: ["title", "chapters", "coverPrompt"]
        }
      }
    });

    if (!response.text) throw new Error("AI 返回了空响应");
    return JSON.parse(response.text) as EbookStructure;
  } catch (error: any) {
    console.error("规划生成错误:", error);
    throw new Error(error.message || "规划大纲失败，请重试。");
  }
};

export const generateEbookContent = async (project: EbookProject, structure: EbookStructure): Promise<string> => {
  const ai = getAI();
  
  const languageInstruction = project.outputLanguage === 'Chinese' 
    ? "请使用简体中文撰写原稿。" 
    : "Write the manuscript in English.";

  const prompt = `
    请为技术文档《${structure.title}》撰写完整的高质量原稿。
    
    创作准则：使用“高密度干货写作法”。
    重点突出代码示例和逻辑推导，避免冗长无用的文字。
    内容深度必须精准匹配目标读者：${getAudienceLabel(project.targetAudience)}。

    配置详情：
    - 技术栈：${project.language}
    - 写作风格：${project.writingStyle}
    - 语言：${languageInstruction}
    - 参考背景：${project.materials}
    
    规划好的章节大纲：
    ${structure.chapters.map((c, i) => `${i + 1}. ${c.title}: ${c.description}`).join("\n")}

    原稿撰写规范：
    - 使用 Markdown 规范（# 书名, ## 章节）。
    - 章节内应包含详细的 ${project.language} 代码实现。
    - 代码块必须标注语言标签。
    - 语调应符合：${getStyleDescription(project.writingStyle)}。
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      if (chunk.text) fullText += chunk.text;
    }

    if (!fullText) throw new Error("AI 未能生成有效原稿。");
    return fullText;
  } catch (error: any) {
    console.error("内容生成错误:", error);
    throw new Error(error.message || "生成内容失败，请检查网络或点数余额。");
  }
};

export const generateBookCover = async (imagePrompt: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A professional book cover for a technical document. Concept: ${imagePrompt}. Minimalist, high contrast, bold typography, vector style.` }]
      },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (error) { console.warn("封面设计失败:", error); }
  return '';
};

function getStyleDescription(style: string): string {
  switch (style) {
    case 'Technical Manual': return '严谨、权威、侧重规格与标准。';
    case 'Tutorial': return '由浅入深、循序渐进、通俗易懂。';
    case 'Practical Guide': return '实战为王、步骤清晰、解决具体痛点。';
    case 'Reference Manual': return '干练简洁、查询高效、条目清晰。';
    default: return '专业技术文档风格。';
  }
}
