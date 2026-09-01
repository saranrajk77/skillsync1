require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;


/* =====================================================
   ADZUNA
===================================================== */

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


/* =====================================================
   SIMPLE SERVER-SIDE USER DATABASE
===================================================== */

/*
   For your local hackathon prototype, users are stored
   in memory.

   IMPORTANT:
   Restarting server.js clears registered users.

   For production, use MongoDB/PostgreSQL/Firebase.
*/

const USERS = new Map();


/* =====================================================
   SESSION DATABASE
===================================================== */

const SESSIONS = new Map();


/* =====================================================
   PASSWORD HASHING
===================================================== */

function hashPassword(password, salt = null) {

    const actualSalt =
        salt ||
        crypto.randomBytes(16).toString("hex");

    const hash =
        crypto.scryptSync(
            password,
            actualSalt,
            64
        ).toString("hex");

    return {
        salt: actualSalt,
        hash
    };
}


function verifyPassword(password, user) {

    const hash =
        crypto.scryptSync(
            password,
            user.salt,
            64
        ).toString("hex");

    return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(user.passwordHash, "hex")
    );
}


/* =====================================================
   SESSION HELPERS
===================================================== */

function createSession(user) {

    const token =
        crypto.randomBytes(32).toString("hex");

    SESSIONS.set(
        token,
        {
            email: user.email,
            createdAt: Date.now()
        }
    );

    return token;
}


function getSessionUser(req) {

    const cookie =
        req.headers.cookie || "";

    const match =
        cookie.match(
            /skillsync_session=([^;]+)/
        );

    if (!match) {
        return null;
    }

    const token = match[1];

    const session =
        SESSIONS.get(token);

    if (!session) {
        return null;
    }

    const user =
        USERS.get(session.email);

    if (!user) {
        return null;
    }

    return user;
}


function requireAuth(req, res, next) {

    const user =
        getSessionUser(req);

    if (!user) {

        return res.status(401).json({
            success: false,
            error: "Please login first."
        });

    }

    req.user = user;

    next();
}


/* =====================================================
   SKILLS DATABASE
===================================================== */

const SKILLS = [

    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "C++",
    "C#",
    "PHP",
    "Go",
    "Ruby",
    "Kotlin",
    "Swift",
    "Rust",

    "HTML",
    "CSS",
    "React",
    "Angular",
    "Vue",
    "Next.js",
    "Tailwind CSS",

    "Node.js",
    "Express",
    "Django",
    "Flask",
    "Spring Boot",
    "REST API",
    "GraphQL",
    "Microservices",

    "SQL",
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Oracle",
    "Redis",
    "Firebase",

    "AWS",
    "Azure",
    "Google Cloud",
    "Docker",
    "Kubernetes",
    "Jenkins",
    "Terraform",
    "CI/CD",

    "Machine Learning",
    "Deep Learning",
    "Artificial Intelligence",
    "Data Science",
    "Data Analysis",
    "Pandas",
    "NumPy",
    "TensorFlow",
    "PyTorch",
    "OpenCV",

    "Excel",
    "Power BI",
    "Tableau",

    "Git",
    "GitHub",
    "Linux",
    "Jira",

    "Cybersecurity",
    "Network Security",
    "Information Security"

];


/* =====================================================
   NORMALIZE
===================================================== */

function normalize(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}


/* =====================================================
   ESCAPE REGEX
===================================================== */

function escapeRegex(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


/* =====================================================
   EXTRACT SKILLS
===================================================== */

function extractSkills(job) {

    const text =
        normalize(
            [
                job.title,
                job.description,
                job.category?.label
            ].join(" ")
        );

    const found = [];

    for (const skill of SKILLS) {

        const pattern =
            new RegExp(
                `(^|[^a-z0-9+#.])${escapeRegex(
                    normalize(skill)
                )}([^a-z0-9+#.]|$)`,
                "i"
            );

        if (pattern.test(text)) {
            found.push(skill);
        }

    }

    return [...new Set(found)];
}


/* =====================================================
   ADZUNA FETCH
===================================================== */

async function fetchJobs(
    keyword = "software developer",
    location = "India"
) {

    if (!APP_ID || !APP_KEY) {

        throw new Error(
            "Adzuna credentials are missing. Check your .env file."
        );

    }

    const params =
        new URLSearchParams();

    params.set(
        "app_id",
        APP_ID
    );

    params.set(
        "app_key",
        APP_KEY
    );

    params.set(
        "results_per_page",
        "50"
    );

    params.set(
        "what",
        keyword
    );

    if (
        location &&
        location !== "India"
    ) {

        params.set(
            "where",
            location
        );

    }

    params.set(
        "content-type",
        "application/json"
    );

    const url =
        `https://api.adzuna.com/v1/api/jobs/in/search/1?${params.toString()}`;

    const response =
        await fetch(url);

    let data;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Adzuna returned invalid data. HTTP ${response.status}`
        );

    }

    if (!response.ok) {

        throw new Error(
            data?.display_name ||
            data?.error ||
            `Adzuna API error: HTTP ${response.status}`
        );

    }

    return data;
}


/* =====================================================
   NORMALIZE JOB
===================================================== */

function normalizeJob(job) {

    return {

        id:
            job.id || null,

        title:
            job.title ||
            "Untitled Job",

        company:
            job.company?.display_name ||
            "Company Not Specified",

        location:
            job.location?.display_name ||
            "Location Not Specified",

        category:
            job.category?.label ||
            "Category Not Specified",

        description:
            job.description ||
            "",

        salaryMin:
            job.salary_min ??
            null,

        salaryMax:
            job.salary_max ??
            null,

        created:
            job.created ||
            null,

        url:
            job.redirect_url ||
            null,

        skills:
            extractSkills(job)

    };

}


/* =====================================================
   AUTH — REGISTER
===================================================== */

app.post(
    "/api/auth/register",
    (req, res) => {

        try {

            const name =
                String(
                    req.body.name || ""
                ).trim();

            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Name, email and password are required."

                });

            }

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                !emailPattern.test(email)
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please enter a valid email."

                });

            }

            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Password must contain at least 6 characters."

                });

            }

            if (
                USERS.has(email)
            ) {

                return res.status(409).json({

                    success: false,

                    error:
                        "An account with this email already exists."

                });

            }

            const passwordData =
                hashPassword(password);

            const user = {

                name,

                email,

                salt:
                    passwordData.salt,

                passwordHash:
                    passwordData.hash,

                createdAt:
                    new Date().toISOString()

            };

            USERS.set(
                email,
                user
            );

            const sessionToken =
                createSession(user);

            res.setHeader(
                "Set-Cookie",
                `skillsync_session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax`
            );

            res.json({

                success: true,

                message:
                    "Account created successfully.",

                user: {

                    name,

                    email

                }

            });

        } catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Registration failed."

            });

        }

    }
);


/* =====================================================
   AUTH — LOGIN
===================================================== */

app.post(
    "/api/auth/login",
    (req, res) => {

        try {

            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Email and password are required."

                });

            }

            const user =
                USERS.get(email);

            if (!user) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Account not found. Please create an account first."

                });

            }

            const valid =
                verifyPassword(
                    password,
                    user
                );

            if (!valid) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Incorrect email or password."

                });

            }

            const sessionToken =
                createSession(user);

            res.setHeader(
                "Set-Cookie",
                `skillsync_session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax`
            );

            res.json({

                success: true,

                message:
                    "Login successful.",

                user: {

                    name:
                        user.name,

                    email:
                        user.email

                }

            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Login failed."

            });

        }

    }
);


/* =====================================================
   CURRENT USER
===================================================== */

app.get(
    "/api/auth/me",
    (req, res) => {

        const user =
            getSessionUser(req);

        if (!user) {

            return res.status(401).json({

                success: false,

                loggedIn: false

            });

        }

        res.json({

            success: true,

            loggedIn: true,

            user: {

                name:
                    user.name,

                email:
                    user.email

            }

        });

    }
);


/* =====================================================
   LOGOUT
===================================================== */

app.post(
    "/api/auth/logout",
    (req, res) => {

        const cookie =
            req.headers.cookie || "";

        const match =
            cookie.match(
                /skillsync_session=([^;]+)/
            );

        if (match) {

            SESSIONS.delete(
                match[1]
            );

        }

        res.setHeader(
            "Set-Cookie",
            "skillsync_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
        );

        res.json({

            success: true,

            message:
                "Logged out successfully."

        });

    }
);


/* =====================================================
   STATUS
===================================================== */

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            success: true,

            status: "online",

            source:
                "Adzuna Live Job Market API",

            apiConfigured:
                Boolean(
                    APP_ID &&
                    APP_KEY
                ),

            message:
                "SkillSync AI backend is running",

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =====================================================
   JOBS
===================================================== */

app.get(
    "/api/jobs",
    async (req, res) => {

        try {

            const keyword =
                String(
                    req.query.keyword ||
                    "software developer"
                ).trim();

            const location =
                String(
                    req.query.location ||
                    "India"
                ).trim();

            const data =
                await fetchJobs(
                    keyword,
                    location
                );

            const jobs =
                (data.results || [])
                    .map(normalizeJob);

            res.json({

                success: true,

                source: "Adzuna",

                keyword,

                location,

                totalJobs:
                    Number(
                        data.count ||
                        jobs.length
                    ),

                jobs

            });

        } catch (error) {

            console.error(
                "JOB ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


/* =====================================================
   SKILL DEMAND
===================================================== */

app.get(
    "/api/skills",
    async (req, res) => {

        try {

            const keyword =
                String(
                    req.query.keyword ||
                    "software developer"
                ).trim();

            const location =
                String(
                    req.query.location ||
                    "India"
                ).trim();

            const data =
                await fetchJobs(
                    keyword,
                    location
                );

            const jobs =
                data.results || [];

            const totalAnalyzed =
                jobs.length;

            const skillCounts = {};

            for (
                const job of jobs
            ) {

                const skills =
                    extractSkills(job);

                for (
                    const skill of skills
                ) {

                    skillCounts[skill] =
                        (
                            skillCounts[skill] ||
                            0
                        ) + 1;

                }

            }

            const skills =
                Object.entries(
                    skillCounts
                )

                .map(
                    ([name, count]) => {

                        const demandPercentage =
                            totalAnalyzed > 0
                                ? Math.round(
                                    (
                                        count /
                                        totalAnalyzed
                                    ) * 100
                                )
                                : 0;

                        let priority =
                            "LOW";

                        if (
                            demandPercentage >= 50
                        ) {

                            priority =
                                "HIGH";

                        } else if (
                            demandPercentage >= 25
                        ) {

                            priority =
                                "MEDIUM";

                        }

                        return {

                            name,

                            jobs:
                                count,

                            demandPercentage,

                            priority

                        };

                    }
                )

                .sort(
                    (a, b) =>
                        b.jobs - a.jobs
                );

            res.json({

                success: true,

                source: "Adzuna",

                keyword,

                location,

                totalJobsAnalyzed:
                    totalAnalyzed,

                skills

            });

        } catch (error) {

            console.error(
                "SKILL ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


/* =====================================================
   COMPANIES
===================================================== */

app.get(
    "/api/companies",
    async (req, res) => {

        try {

            const keyword =
                String(
                    req.query.keyword ||
                    "software developer"
                ).trim();

            const location =
                String(
                    req.query.location ||
                    "India"
                ).trim();

            const data =
                await fetchJobs(
                    keyword,
                    location
                );

            const companies = {};

            for (
                const job of
                data.results || []
            ) {

                const companyName =
                    job.company?.display_name ||
                    "Company Not Specified";

                if (
                    !companies[companyName]
                ) {

                    companies[companyName] = {

                        name:
                            companyName,

                        jobs:
                            0,

                        skillCounts:
                            {}

                    };

                }

                companies[companyName]
                    .jobs++;

                const skills =
                    extractSkills(job);

                for (
                    const skill of skills
                ) {

                    companies[companyName]
                        .skillCounts[skill] =
                        (
                            companies[companyName]
                                .skillCounts[skill] ||
                            0
                        ) + 1;

                }

            }

            const result =
                Object.values(
                    companies
                )

                .map(
                    company => {

                        const skills =
                            Object.entries(
                                company.skillCounts
                            )

                            .map(
                                ([name, count]) => ({

                                    name,

                                    jobs:
                                        count,

                                    percentage:
                                        company.jobs > 0
                                            ? Math.round(
                                                (
                                                    count /
                                                    company.jobs
                                                ) * 100
                                            )
                                            : 0

                                })
                            )

                            .sort(
                                (a, b) =>
                                    b.jobs - a.jobs
                            );

                        return {

                            name:
                                company.name,

                            jobs:
                                company.jobs,

                            skills

                        };

                    }
                )

                .sort(
                    (a, b) =>
                        b.jobs - a.jobs
                );

            res.json({

                success: true,

                source: "Adzuna",

                keyword,

                location,

                totalCompanies:
                    result.length,

                companies:
                    result

            });

        } catch (error) {

            console.error(
                "COMPANY ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


/* =====================================================
   SKILL GAP ANALYSIS
===================================================== */

app.get(
    "/api/skill-gap",
    async (req, res) => {

        try {

            const keyword =
                String(
                    req.query.keyword ||
                    "software developer"
                ).trim();

            const location =
                String(
                    req.query.location ||
                    "India"
                ).trim();

            const knownSkills =
                String(
                    req.query.skills ||
                    ""
                )
                .split(",")
                .map(
                    skill =>
                        normalize(skill)
                )
                .filter(Boolean);

            const data =
                await fetchJobs(
                    keyword,
                    location
                );

            const jobs =
                data.results || [];

            const skillCounts = {};

            for (
                const job of jobs
            ) {

                const jobSkills =
                    extractSkills(job);

                for (
                    const skill of jobSkills
                ) {

                    const normalized =
                        normalize(skill);

                    skillCounts[normalized] =
                        (
                            skillCounts[normalized] ||
                            0
                        ) + 1;

                }

            }

            const demandSkills =
                Object.entries(
                    skillCounts
                )

                .map(
                    ([normalizedName, count]) => {

                        const originalName =
                            SKILLS.find(
                                skill =>
                                    normalize(skill) ===
                                    normalizedName
                            ) ||
                            normalizedName;

                        const percentage =
                            jobs.length > 0
                                ? Math.round(
                                    (
                                        count /
                                        jobs.length
                                    ) * 100
                                )
                                : 0;

                        return {

                            name:
                                originalName,

                            jobs:
                                count,

                            percentage

                        };

                    }
                )

                .sort(
                    (a, b) =>
                        b.jobs - a.jobs
                );

            const knownSet =
                new Set(
                    knownSkills
                );

            const matchingSkills =
                demandSkills.filter(
                    skill =>
                        knownSet.has(
                            normalize(skill.name)
                        )
                );

            const missingSkills =
                demandSkills.filter(
                    skill =>
                        !knownSet.has(
                            normalize(skill.name)
                        )
                );

            /*
             * Recommendations:
             * High-demand skills missing from
             * the user's current skill set.
             */

            const recommendations =
                missingSkills
                    .slice(0, 10)
                    .map(
                        skill => ({

                            skill:
                                skill.name,

                            demand:
                                skill.percentage,

                            jobs:
                                skill.jobs,

                            reason:
                                `${skill.name} appears in ${skill.percentage}% of analyzed ${keyword} jobs.`

                        })
                    );

            /*
             * Job-by-job matching.
             */

            const analyzedJobs =
                jobs
                    .map(normalizeJob)
                    .map(job => {

                        const required =
                            job.skills;

                        const known =
                            required.filter(
                                skill =>
                                    knownSet.has(
                                        normalize(skill)
                                    )
                            );

                        const missing =
                            required.filter(
                                skill =>
                                    !knownSet.has(
                                        normalize(skill)
                                    )
                            );

                        const matchPercentage =
                            required.length > 0
                                ? Math.round(
                                    (
                                        known.length /
                                        required.length
                                    ) * 100
                                )
                                : 0;

                        return {

                            ...job,

                            knownSkills:
                                known,

                            missingSkills:
                                missing,

                            matchPercentage

                        };

                    })
                    .sort(
                        (a, b) =>
                            b.matchPercentage -
                            a.matchPercentage
                    );

            /*
             * Overall match score.
             */

            const totalRequired =
                analyzedJobs.reduce(
                    (sum, job) =>
                        sum +
                        job.skills.length,
                    0
                );

            const totalKnown =
                analyzedJobs.reduce(
                    (sum, job) =>
                        sum +
                        job.knownSkills.length,
                    0
                );

            const overallScore =
                totalRequired > 0
                    ? Math.round(
                        (
                            totalKnown /
                            totalRequired
                        ) * 100
                    )
                    : 0;

            res.json({

                success: true,

                keyword,

                location,

                knownSkills,

                jobsAnalyzed:
                    jobs.length,

                overallScore,

                matchingSkills,

                missingSkills,

                recommendations,

                jobs:
                    analyzedJobs

            });

        } catch (error) {

            console.error(
                "SKILL GAP ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


/* =====================================================
   FRONTEND
===================================================== */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* =====================================================
   HOMEPAGE
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


/* =====================================================
   DASHBOARD
===================================================== */

app.get(
    "/dashboard",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


/* =====================================================
   404
===================================================== */

app.use(
    (req, res) => {

        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(404).json({

                success: false,

                error:
                    "API endpoint not found.",

                path:
                    req.path

            });

        }

        res.status(404).send(
            "Page not found."
        );

    }
);


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message ||
                "Internal server error."

        });

    }
);


/* =====================================================
   START
===================================================== */

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=============================================="
        );
        console.log(
            "              SKILLSYNC AI"
        );
        console.log(
            "        LIVE JOB MARKET ENGINE"
        );
        console.log(
            "=============================================="
        );

        console.log("");

        console.log(
            `🚀 Website: http://localhost:${PORT}`
        );

        console.log(
            `🔐 Login: http://localhost:${PORT}`
        );

        console.log(
            `📊 Status: http://localhost:${PORT}/api/status`
        );

        console.log(
            `💼 Jobs: http://localhost:${PORT}/api/jobs`
        );

        console.log(
            `🔥 Skills: http://localhost:${PORT}/api/skills`
        );

        console.log(
            `🏢 Companies: http://localhost:${PORT}/api/companies`
        );

        console.log(
            `🎯 Skill Gap: http://localhost:${PORT}/api/skill-gap`
        );

        console.log("");

        console.log(
            APP_ID && APP_KEY
                ? "✅ Adzuna credentials detected"
                : "❌ Adzuna credentials missing"
        );

        console.log("");

        console.log(
            "=============================================="
        );

        console.log("");

    }
);