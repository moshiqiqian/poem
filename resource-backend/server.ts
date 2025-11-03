// resource-backend/server.ts
import express from 'express'; 
import * as mysql from 'mysql2/promise'; // FIX: Changed to namespace import to resolve SyntaxError with RowDataPacket/ResultSetHeader in ts-node/ESM environment
import cors from 'cors'; 
import bodyParser from 'body-parser'; 

// --- 1. 配置常量 ---
const PORT = 3000; 

const dbConfig = {
    host: 'localhost', 		
    user: 'root', 			
    password: '', 			
    database: 'resource_db', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// --- 2. TypeScript 接口定义 ---
interface PoemResult {
    id: number;
    title: string;
    content: string;
    author: string; // FIX: 更改为 author，以匹配数据库中的字段名
    dynasty: string;
}

interface CommentResult {
    id: number;
    poemID: number;
    content: string;
    username: string;
    createdAt: string;
    parentID: number | null; // 更新：支持父评论ID
}

interface NewCommentBody {
    poemID: number;
    content: string;
    username?: string; 
    parentID?: number | null; // 更新：支持回复的父评论ID
}

// 关系图谱的接口定义
interface PoetNode {
    id: string; // 对应 poet.name
    dynasty: string;
    group: number; // 用于D3颜色分组 (1:唐, 2:宋, ...)
}

interface PoetLink {
    source: string; // 对应 poetA_name
    target: string; // 对应 poetB_name
    relation: string;
    value: number; // 关系强度/权重
}

interface RelationshipData {
    nodes: PoetNode[];
    links: PoetLink[];
}


// --- 3. 初始化应用和数据库连接池 ---
const app: express.Application = express(); 
let pool: mysql.Pool; 

// --- 4. 配置 Express 中间件 ---
app.use(bodyParser.json());

// 启用 CORS
app.use(cors({ 
    origin: '*', // 允许所有来源访问
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
}));


// ----------------------------------------------------
// --- 5. API 路由定义 (新增关系图谱 API) ---
// ----------------------------------------------------

/**
 * 辅助函数：根据朝代获取 D3 分组 ID
 */
const getDynastyGroup = (dynasty: string): number => {
    if (dynasty.includes('唐')) return 1;
    if (dynasty.includes('宋')) return 2;
    if (dynasty.includes('清')) return 3;
    if (dynasty.includes('明')) return 4;
    return 99; // 其他朝代
};


/**
 * GET /api/relationships
 * 获取诗人关系图谱数据 (节点和边)
 */
app.get('/api/relationships', async (req: express.Request, res: express.Response) => {
    try {
        // 1. 查询所有诗人 (图谱节点)
        const nodesSql = `SELECT name, dynasty FROM poet`;
        const [nodesRows] = await pool.query<mysql.RowDataPacket[]>(nodesSql); 

        const nodes: PoetNode[] = nodesRows.map(row => ({
            id: row.name,
            dynasty: row.dynasty,
            group: getDynastyGroup(row.dynasty)
        }));

        // 2. 查询所有关系 (图谱边)
        const linksSql = `SELECT poetA_name, poetB_name, relation, value FROM poet_relationship`;
        const [linksRows] = await pool.query<mysql.RowDataPacket[]>(linksSql); 

        const links: PoetLink[] = linksRows.map(row => ({
            source: row.poetA_name,
            target: row.poetB_name,
            relation: row.relation,
            value: row.value
        }));

        const relationshipData: RelationshipData = { nodes, links };

        res.status(200).json({ 
            code: 200, 
            message: '关系图谱数据获取成功！',
            data: relationshipData
        });

    } catch (error) {
        console.error('获取关系图谱数据失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误，获取关系图谱数据失败。' });
    }
});


/**
 * GET /api/poems
 * 获取所有古诗列表
 */
app.get('/api/poems', async (req: express.Request, res: express.Response) => {
    const sql = `
        SELECT 
            p.id, 
            p.title, 
            LEFT(p.content, 100) AS content, 
            pt.name AS author,  -- FIX: 从 poet 表中获取作者名
            pt.dynasty          -- FIX: 从 poet 表中获取朝代
        FROM poem p
        JOIN poet pt ON p.poetID = pt.id -- FIX: 联结 poet 表
        LIMIT 200
    `;
    
    try {
        const [rows] = await pool.query<mysql.RowDataPacket[]>(sql); 
        const poems = rows as PoemResult[];

        res.status(200).json({ 
            code: 200, 
            message: '古诗列表获取成功！', 
            data: poems.map(p => ({
                id: p.id,
                title: p.title,
                content: p.content,
                author: p.author, 
                dynasty: p.dynasty
            }))
        });

    } catch (error) {
        console.error('获取古诗列表失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误，获取古诗列表失败。' });
    }
});


/**
 * GET /api/poem/:id
 * 获取单个古诗详情
 */
app.get('/api/poem/:id', async (req: express.Request, res: express.Response) => {
    const poemID = parseInt(req.params.id, 10);
    if (isNaN(poemID)) {
        return res.status(400).json({ code: 400, message: '古诗ID无效。' });
    }

    const sql = `
        SELECT 
            p.id, 
            p.title, 
            p.content, 
            pt.name AS author,  -- FIX: 从 poet 表中获取作者名
            pt.dynasty          -- FIX: 从 poet 表中获取朝代
        FROM poem p
        JOIN poet pt ON p.poetID = pt.id -- FIX: 联结 poet 表
        WHERE p.id = ?
    `;

    try {
        const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, [poemID]); 
        const poem = rows[0] as PoemResult;

        if (poem) {
            res.status(200).json({ 
                code: 200, 
                message: '古诗详情获取成功！', 
                data: poem
            });
        } else {
            res.status(404).json({ code: 404, message: '未找到该古诗。' });
        }

    } catch (error) {
        console.error('获取古诗详情失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误，获取古诗详情失败。' });
    }
});


/**
 * GET /api/comments/:poemID
 * 获取指定古诗的所有评论
 */
app.get('/api/comments/:poemID', async (req: express.Request, res: express.Response) => {
    const poemID = parseInt(req.params.poemID, 10);
    if (isNaN(poemID)) {
        return res.status(400).json({ code: 400, message: '古诗ID无效。' });
    }

    const sql = `
        SELECT 
            id, 
            poemID, 
            content, 
            username, 
            createdAt,
            parentID 
        FROM comment 
        WHERE poemID = ?
        ORDER BY createdAt ASC
    `;
    
    try {
        const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, [poemID]); 
        const comments = rows as CommentResult[];
        
        res.status(200).json({ 
            code: 200, 
            message: '评论获取成功！', 
            data: comments
        });
        
    } catch (error) {
        console.error('获取评论失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误，获取评论失败。' });
    }
});


/**
 * POST /api/comments
 * 新增评论 (支持回复)
 */
app.post('/api/comments', async (req: express.Request, res: express.Response) => {
    // 解构 body，并设置 parentID 的默认值为 null
    const { poemID, content, username = '匿名用户', parentID = null } = req.body as NewCommentBody;

    if (!poemID || !content) {
        return res.status(400).json({ code: 400, message: '缺少古诗ID或评论内容。' });
    }
    
    // 确保 SQL 语句包含 parentID 字段
    const sql = `
        INSERT INTO comment (poemID, content, username, parentID) 
        VALUES (?, ?, ?, ?)
    `;
    
    try {
        const [result] = await pool.execute(sql, [poemID, content, username, parentID]);
        
        res.status(201).json({ 
            code: 201, 
            message: '评论添加成功！',
            insertedId: (result as mysql.ResultSetHeader).insertId 
        });
        
    } catch (error) {
        console.error('新增评论失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误，评论添加失败。' });
    }
});


// ----------------------------------------------------
// --- 6. 启动流程 ---
// ----------------------------------------------------

async function initializeServer() {
    try {
        // 尝试测试连接
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1'); // 测试连接是否成功
        console.log('✅ 数据库连接成功！');

        app.listen(PORT, () => {
            console.log(`🚀 服务器已在 http://localhost:${PORT} 启动`);
        });
    } catch (error) {
        console.error('❌ 服务器初始化失败:', error);
        process.exit(1); // 退出应用
    }
}

initializeServer();
