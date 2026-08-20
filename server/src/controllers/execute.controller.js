import { codeQueue } from "../queue/code.queue.js";

export const executeCode = async (req, res) => {
  try {
    const { jobId, language, code, input } = req.body;

    if (!jobId || !language || !code) {
      return res.status(400).json({
        success: false,
        message: "jobId, language and code are required",
      });
    }

    const supportedLanguages = ["python", "javascript", "cpp", "java"];

    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported language",
      });
    }

    const job = await codeQueue.add(
      "execute-job",
      { language, code, input: input || "" },
      { jobId } // use the client-supplied ID as the BullMQ job ID
    );

    return res.json({
      success: true,
      jobId: job.id,
      message: "Code execution started",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Execution Failed",
    });
  }
};