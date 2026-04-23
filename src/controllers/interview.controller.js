const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

function getErrorStatus(error) {
    return error.status || error.statusCode || error.response?.status
}

function isForbiddenError(error) {
    const status = getErrorStatus(error)
    return status === 403 || String(status) === "403" || String(error.message || "").includes("403")
}


/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {

    const { selfDescription = "", jobDescription = "" } = req.body
    let resumeContent = { text: "" }

    if (req.file) {
        try {
            resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
        } catch (error) {
            return res.status(400).json({
                message: "Could not read the uploaded PDF. Please upload a valid PDF file."
            })
        }
    }

    if (!jobDescription.trim() || (!resumeContent.text.trim() && !selfDescription.trim())) {
        return res.status(400).json({
            message: "Job description and either resume or self description are required."
        })
    }

    let interViewReportByAi
    try {
        interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription
        })
    } catch (error) {
        console.error("Failed to generate interview report:", error)
        const status = getErrorStatus(error)
        return res.status(Number(status) || 502).json({
            message: isForbiddenError(error)
                ? "AI report generation was rejected by the AI provider. Please check the backend API key, model access, and billing/project permissions."
                : `AI report generation failed${status ? ` with status ${status}` : ""}. Please try again.`
        })
    }

    let interviewReport
    try {
        interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })
    } catch (error) {
        console.error("Failed to save interview report:", error)
        return res.status(500).json({
            message: "Interview report was generated but could not be saved."
        })
    }

    res.status(201).json({
        message: "Interview report generated successfully.",
        interviewReport
    })

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    let pdfBuffer
    try {
        pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })
    } catch (error) {
        console.error("Failed to generate resume PDF:", error)
        return res.status(502).json({
            message: String(error.message || "").includes("Could not find Chrome")
                ? "Resume PDF generation failed because Chrome is not available on the backend server. Redeploy the backend with Puppeteer browser installation enabled."
                : "Resume PDF generation failed. Please try again."
        })
    }

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }
