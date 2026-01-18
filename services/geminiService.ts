
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { EbookProject, EbookStructure, PPTStructure } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getAudienceLabel = (audience: string) => {
  switch(audience) {
    case 'Novice': return '入门新手（零基础或基础薄弱）';
    case 'Intermediate': return '中级工程师（已有一定开发经验）';
    case 'Expert': return '高级专家（追求深度与底层架构）';
    default: return audience;
  }
};

const getStyleDescription = (style: string): string => {
  switch (style) {
    case 'Technical Manual': return '严谨、权威、侧重规格与标准。';
    case 'Tutorial': return '由浅入深、循序渐进、通俗易懂。';
    case 'Practical Guide': return '实战为王、步骤清晰、解决具体痛点。';
    case 'Reference Manual': return '干练简洁、查询高效、条目清晰。';
    default: return '专业技术文档风格。';
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
    3. 每个章节的核心知识点编排（要点形式），并建议该章节的页数（estimatedPages，通常 2-10 页）。
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
                  description: { type: Type.STRING },
                  estimatedPages: { type: Type.INTEGER }
                },
                required: ["title", "description", "estimatedPages"]
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

export const generateChapterContent = async (
  project: EbookProject, 
  structure: EbookStructure, 
  chapterIndex: number
): Promise<string> => {
  const ai = getAI();
  const chapter = structure.chapters[chapterIndex];
  
  const languageInstruction = project.outputLanguage === 'Chinese' 
    ? "请使用简体中文撰写。" 
    : "Write in English.";

  const prompt = `
    你正在为图书《${structure.title}》撰写第 ${chapterIndex + 1} 章。
    
    章节标题：${chapter.title}
    章节描述：${chapter.description}
    目标页数：${chapter.estimatedPages} 页 (请确保内容详实，深度匹配目标受众)。
    
    写作规范：
    - 目标读者：${getAudienceLabel(project.targetAudience)}
    - 技术栈：${project.language}
    - 风格调性：${getStyleDescription(project.writingStyle)}
    - 语言：${languageInstruction}
    - 使用 Markdown 格式。
    - 包含丰富的代码示例。
    - 参考资料背景：${project.materials}

    仅输出本章节的内容，以 ## ${chapter.title} 开头。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    if (!response.text) throw new Error(`第 ${chapterIndex + 1} 章生成失败`);
    return response.text;
  } catch (error: any) {
    throw new Error(error.message || "章节生成失败");
  }
};

export const generateEbookContent = async (project: EbookProject, structure: EbookStructure): Promise<string> => {
  // This can be kept as a batch call or a series of chapter calls
  const ai = getAI();
  const prompt = `
    请为图书《${structure.title}》撰写完整的高质量原稿。
    
    章节分布：
    ${structure.chapters.map((c, i) => `${i + 1}. ${c.title} (目标约 ${c.estimatedPages} 页): ${c.description}`).join("\n")}

    创作准则：
    - 目标受众：${getAudienceLabel(project.targetAudience)}
    - 语言：${project.outputLanguage === 'Chinese' ? '简体中文' : 'English'}
    - 风格：${getStyleDescription(project.writingStyle)}
    - 参考资料：${project.materials}
    
    请输出完整的 Markdown 稿件。
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
    return fullText;
  } catch (error: any) {
    throw new Error(error.message || "内容生成失败");
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

export const generatePPTStructure = async (
  title: string, 
  content: string, 
  slideCount: number, 
  coverPrompt: string,
  targetAudience: string
): Promise<PPTStructure> => {
  const ai = getAI();
  const prompt = `
    请基于图书内容《${title}》生成一份专业的演示文稿 (PPT) 大纲。
    目标幻灯片数量：${slideCount} 页。
    图书封面视觉风格参考：${coverPrompt}
    目标受众：${targetAudience}

    内容要求：
    1. 包含封面页、目录页、核心知识点拆解页及总结致谢页。
    2. 每页提供一个标题和若干个简洁的要点 (Content Points)。
    3. 根据图书风格建议一套配色方案。
    
    输出格式要求：JSON。
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
            theme: {
              type: Type.OBJECT,
              properties: {
                primaryColor: { type: Type.STRING },
                secondaryColor: { type: Type.STRING },
                backgroundColor: { type: Type.STRING },
                textColor: { type: Type.STRING }
              },
              required: ["primaryColor", "secondaryColor", "backgroundColor", "textColor"]
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.ARRAY, items: { type: Type.STRING } },
                  layout: { type: Type.STRING, enum: ['TITLE', 'BULLETS', 'SECTION', 'THANKS'] }
                },
                required: ["title", "content", "layout"]
              }
            }
          },
          required: ["theme", "slides"]
        }
      }
    });

    if (!response.text) throw new Error("AI 返回了空 PPT 响应");
    return JSON.parse(response.text) as PPTStructure;
  } catch (error: any) {
    console.error("PPT 规划失败:", error);
    throw new Error("PPT 规划失败，请检查图书内容。");
  }
};
