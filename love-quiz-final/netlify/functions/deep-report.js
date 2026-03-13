const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: '方法不允许' }) };

  try {
    const { result_type, hex } = JSON.parse(event.body || '{}');

    // 获取真实IP（Netlify 会把真实IP放在这些header里）
    const ip =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] ||
      'unknown';

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // 查询该IP使用次数
    const { data: ipRecord } = await supabase
      .from('ip_usage')
      .select('*')
      .eq('ip', ip)
      .single();

    const MAX_USES = 2;

    if (ipRecord && ipRecord.used_count >= MAX_USES) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          error: 'limit',
          message: '每个设备限免费使用2次哦～'
        })
      };
    }

    // 扣减/新增IP记录
    if (ipRecord) {
      await supabase
        .from('ip_usage')
        .update({ used_count: ipRecord.used_count + 1, last_used_at: new Date().toISOString() })
        .eq('ip', ip);
    } else {
      await supabase
        .from('ip_usage')
        .insert({ ip, used_count: 1, last_used_at: new Date().toISOString() });
    }

    const remaining = MAX_USES - (ipRecord ? ipRecord.used_count : 0) - 1;

    // 构建 Kimi prompt
    const typeNames = {
      passion:     '烈焰玫瑰型（激情主动）',
      security:    '深海珍珠型（安全感渴望）',
      independence:'自由行星型（独立自主）',
      sensitivity: '星光诗人型（敏感细腻）'
    };

    const hexDesc = hex ? `
恋爱六维数据：
· 主动热情：${hex.passion}%  · 感受力：${hex.sensitivity}%  · 浪漫指数：${hex.romance}%
· 专一度：${hex.loyalty}%   · 独立指数：${hex.independence}%  · 安全感：${hex.security}%` : '';

    const prompt = `你是一位温柔且深刻的恋爱心理分析师，语气像知心姐姐：细腻、有共情力、精准，让女生觉得"被完全看见了"。

用户恋爱测试数据：
- 主类型：${typeNames[result_type] || result_type}
${hexDesc}

请生成一份"恋爱深度测试报告"，严格按以下5个版块输出，每个版块标题保留emoji，版块之间空一行：

【💌 你的恋爱真实画像】
（约120字，描述她在爱情里最真实的模样，要让人看了脊背发凉地觉得"说的就是我"。结合六维数据分析，不要泛泛而谈）

【🌙 你最渴望被懂的那一面】
（约100字，说出她内心深处最希望伴侣理解但从未开口的那件事。越精准越好，触达内心深处）

【⚡ 你在恋爱里的隐藏弱点】
（约100字，指出她在感情里最容易踩的坑。扎心但温柔，像闺蜜说悄悄话，不评判，就是"我懂你"）

【💫 三条专属恋爱锦囊】
（三条，每条以"✦ "开头，约35字，要具体可执行，不能是废话，针对她的类型定制）

【🌹 你的恋爱星运预言】
（约70字，浪漫温柔，给她信心和期待，像塔罗牌占卜师说的话，有余味，结尾要让人想截图发朋友圈）

写作要求：用"你"不用"您"，语气温柔自然，像读心术，绝不说教，读完让人想立刻分享给闺蜜。`;

    const kimiRes = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KIMI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 1400
      })
    });

    if (!kimiRes.ok) {
      const errText = await kimiRes.text();
      console.error('Kimi error:', kimiRes.status, errText);
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'ai_fail', message: '报告生成失败，请稍后重试' }) };
    }

    const kimiData = await kimiRes.json();
    const report = kimiData.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, report, remaining })
    };

  } catch (err) {
    console.error('deep-report error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server', message: '服务器异常，请稍后重试' }) };
  }
};
