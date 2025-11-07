// resource-backend/server.ts
import express from 'express'; 
import * as mysql from 'mysql2/promise'; 
import cors from 'cors'; 
import bodyParser from 'body-parser'; 

// **最终修复：按照错误提示，使用命名空间导入，并提取所需类型**
import * as mysqlTypes from 'mysql2';
type RowDataPacket = mysqlTypes.RowDataPacket;
type ResultSetHeader = mysqlTypes.ResultSetHeader;

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
    author: string; 
    dynasty: string;
}

interface CommentResult {
    id: number;
    poemID: number;
    content: string;
    username: string;
    createdAt: string;
    parentID: number | null; 
}

interface NewCommentBody {
    poemID: number;
    content: string;
    username?: string; 
    parentID?: number | null; 
}

interface PoetNode {
    id: string; // D3 节点ID，对应 poet.name
    dynasty: string;
    group: number; 
}

interface PoetLink {
    source: string; // D3 连线源节点ID (poet.name)
    target: string; // D3 连线目标节点ID (poet.name)
    relation: string;
    value: number; 
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
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
}));


// ----------------------------------------------------
// --- 5. API 路由定义 (已添加搜索和调试日志) ---
// ----------------------------------------------------

/**
 * 辅助函数：根据朝代获取 D3 分组 ID
 */
const getDynastyGroup = (dynasty: string): number => {
    // 明确划分分组，确保所有朝代都有一个组ID
    if (dynasty.includes('唐')) return 1;
    if (dynasty.includes('宋')) return 2;
    if (dynasty.includes('清')) return 3;
    if (dynasty.includes('明')) return 4;
    if (dynasty.includes('魏晋')) return 5; // 增强分组支持
    if (dynasty.includes('汉')) return 6; 
    return 99; // 其他朝代/未分类
};


/**
 * GET /api/relationships
 * 获取诗人关系图谱数据 (节点和边)
 */
app.get('/api/relationships', async (req: express.Request, res: express.Response) => {
    try {
        // 1. 查询所有诗人 (图谱节点) - 确保所有诗人都包含在内
        const nodesSql = `SELECT name, dynasty FROM poet`;
        const [nodesRows] = await pool.query<RowDataPacket[]>(nodesSql); 

        const nodes: PoetNode[] = nodesRows.map(row => ({
            id: row.name as string, // 使用 name 作为 D3 节点ID
            dynasty: row.dynasty as string,
            group: getDynastyGroup(row.dynasty as string)
        }));

        // 2. 查询所有关系 (图谱边)
        const linksSql = `SELECT poetA_name, poetB_name, relation, value FROM poet_relationship`;
        const [linksRows] = await pool.query<RowDataPacket[]>(linksSql); 

        const links: PoetLink[] = linksRows.map(row => ({
            source: row.poetA_name as string, // 使用 name 作为 D3 连线源节点ID
            target: row.poetB_name as string, // 使用 name 作为 D3 连线目标节点ID
            relation: row.relation as string,
            value: row.value as number
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
 * 获取所有古诗列表，支持搜索查询 (search: 诗人,朝代,诗名)
 */
app.get('/api/poems', async (req: express.Request, res: express.Response) => {
    const searchQuery = req.query.search as string; 
    let sql = `
        SELECT 
            p.id, 
            p.title, 
            LEFT(p.content, 100) AS content, 
            pt.name AS author,  
            pt.dynasty          
        FROM poem p
        JOIN poet pt ON p.poetID = pt.id 
    `;
    const params: string[] = [];

    // **构建搜索条件**
    if (searchQuery) {
        const searchPattern = `%${searchQuery}%`;
        sql += `
            WHERE 
                p.title LIKE ? OR
                pt.name LIKE ? OR
                pt.dynasty LIKE ?
        `;
        // 绑定参数
        params.push(searchPattern, searchPattern, searchPattern); 
    }
    
    sql += ` LIMIT 200`; // 限制结果数量

    // **【调试日志】**
    console.log('--- 搜索调试信息 ---');
    console.log('接收到的搜索关键词 (searchQuery):', searchQuery);
    console.log('最终执行的 SQL (带占位符):', sql.replace(/\s+/g, ' ').trim()); // 格式化输出SQL
    console.log('绑定的参数 (params):', params);
    console.log('----------------------');
    // **【调试日志结束】**


    try {
        // 使用 params 数组来安全地绑定 SQL 参数
        const [rows] = await pool.query<RowDataPacket[]>(sql, params); 
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
            pt.name AS author,  
            pt.dynasty          
        FROM poem p
        JOIN poet pt ON p.poetID = pt.id 
        WHERE p.id = ?
    `;

    try {
        const [rows] = await pool.query<RowDataPacket[]>(sql, [poemID]); 
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
        const [rows] = await pool.query<RowDataPacket[]>(sql, [poemID]); 
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
    const { poemID, content, username = '匿名用户', parentID = null } = req.body as NewCommentBody;

    if (!poemID || !content) {
        return res.status(400).json({ code: 400, message: '缺少古诗ID或评论内容。' });
    }
    
    const sql = `
        INSERT INTO comment (poemID, content, username, parentID) 
        VALUES (?, ?, ?, ?)
    `;
    
    try {
        // 注意：这里需要将 mysql.ResultSetHeader 强制转换为我们通过 import 获得的 ResultSetHeader 类型
        const [result] = await pool.execute(sql, [poemID, content, username, parentID]);
        
        res.status(201).json({ 
            code: 201, 
            message: '评论添加成功！',
            insertedId: (result as ResultSetHeader).insertId 
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