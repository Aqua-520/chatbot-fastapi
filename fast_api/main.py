import json
import os
from datetime import datetime
from typing import Any,Optional
# fastapi相关
import uvicorn
from fastapi import FastAPI,Request
# 类型限定
from pydantic import BaseModel,Field
# 导入openai
from openai import OpenAI
from openai.types.chat import ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam,ChatCompletionAssistantMessageParam, \
    ChatCompletionMessageParam
# 导入打印日志功能的包
import logging
# uvicorn自带的模块
from starlette.responses import JSONResponse

# 定义日志配置
logging.basicConfig(
    level='INFO',
    # 时间戳,模块名,日志等级,打印日志的行数,详细信息
    format="%(asctime)s - %(name)s - %(levelname)s - %(lineno)d - %(message)s",
)
# 定义fastapi对象
app = FastAPI(title='ai聊天机器人的后端程序员',description='很多可爱的学生角色,阿罗娜等',version='1.0.1')


# 文件路径对象
resource_obj = {
    # 角色设定
    "preset_path":"data/companion_presets.json",
    #会话路径
    "sessions_dir":"sessions"
}
# 定义返回的响应体格式对象
class ResponseBase(BaseModel):
    code: int
    message: str
    data: Any = None

# -------------------工具函数utils
def get_now_format_time():
    # 调用time函数获取当前时间
    time_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return time_str

# 会话管理文件夹的鉴定
def create_sessions_path():
    sessions_dir = resource_obj["sessions_dir"]
    # 判断是否有这个文件夹
    if not os.path.exists(sessions_dir):
        # 没有则进行文件夹创建
        os.mkdir(sessions_dir)
create_sessions_path()

# 定义全局的异常捕获函数
# Exception参数能拿到错误事件对象,传入被这个装饰器包裹的函数参数中
@app.exception_handler(Exception)
def handle_exception(request:Request,exc:Exception):
    # 第一个参数接收http请求对象,包含请求行头体具体信息,第二个参数接收错误对象
    logging.error("接口出现异常,错误信息为%s"% exc)
    return JSONResponse(
        status_code=500,
        content={
            "code":200,
            "message":'服务器正在维护'
        }
    )

# -------------------获取角色预设,前端在一开始会发起这个请求
@app.get("/api/presets",summary='加载角色预设')
async def get_presets():
    # 判断资源是否存在
    if not os.path.exists(resource_obj['preset_path']):
        # 如果不存在则返回失败响应对象
        return ResponseBase(code=500,message='没找到角色预设信息')

    # 找到了则读取文件内容
    with open(resource_obj["preset_path"],'r',encoding='utf-8') as file:
        # with是上下文管理器,在with内定义的变量是为当前的全局作用域之下
        presets_list = json.load(file)

    # 可以进行一波基础排序
    presets_list = sorted(presets_list,key=lambda item: item['sort_order'])
    # 创建响应对象
    response_data = ResponseBase(code=200, message='获取角色设定预设成功', data=presets_list)

    # 返回响应对象
    return response_data

# -------------------创建新会话的函数,由别的功能来做if判断是否要调用新建会话的能力
# 定义新建会话需要的请求体的格式
class CreateSessionModel(BaseModel):
    nature: Optional[str] = Field(description='角色性格')
    nick_name: Optional[str] = Field(description='角色昵称')
@app.post('/api/sessions',summary='创建会话记录',response_model=ResponseBase)
def create_sessions(request:CreateSessionModel)->ResponseBase:
    # 会话id,没有json的后缀
    session_id = f"session_{get_now_format_time()}"

    # 获取文件名,用会话id做
    filename_only = f"{session_id}.json"

    # 路径拼接,要放到sessions目录之下
    full_file_path = os.path.join(resource_obj['sessions_dir'],filename_only)

    # 创建需要文件保存的dict,格式
    current_session = {
        "session_name": session_id,
        "nick_name":request.nick_name,
        "nature":request.nature,
        "message":[]
    }

    # 文件写入,打开拼接后的完整路径下的文件名称
    with open(full_file_path,'w',encoding='utf-8') as file:
        json.dump(current_session,file,indent=4,ensure_ascii=False)

    # 返回响应体
    return ResponseBase(code=200,message='创建会话成功',data=session_id)

# -------------------获取会话历史记录列表
@app.get('/api/sessions',summary='获取会话历史记录列表',response_model=ResponseBase)
def get_sessions():
    # 遍历sessions目录下有几个文件,把名字拿出来拼到list当中
    dir_path = resource_obj['sessions_dir']

    file_list = os.listdir(dir_path)
    # 截取出json文件,并去掉后缀名
    file_list = [os.path.splitext(i)[0] for i in file_list if i.endswith('.json')]

    # 数据排序,降序
    file_list = sorted(file_list,reverse=True)
    return ResponseBase(
        code=200,
        message='获取历史会话列表成功',
        data=file_list
    )


# -------------------切换历史会话信息
@app.get("/api/sessions/{session_name}",summary='切换历史会话,加载出对应聊天记录文件',response_model=ResponseBase)
def get_current_session(session_name):
    # print(f'当前切换的历史记录为:{session_name}')
    logging.info('切换到历史会话:%s' % session_name)

    # 拿着当前会话id,拼接json,打开对应文件进行读取
    file_path = os.path.join(resource_obj['sessions_dir'],f'{session_name}.json')

    # 打开文件
    with open(file_path,'r',encoding='utf-8') as file:
        content = json.load(file)

    # 直接将文件中内容丢回前端
    return ResponseBase(
        code=200,
        message='切换会话历史成功',
        data=content
    )

# -------------------删除某一条会话历史
@app.delete("/api/sessions/{session_name}",summary='删除某一条聊天记录',response_model=ResponseBase)
def remove_session(session_name: str):
    # 拼接路径查找到对应文件
    file_path = os.path.join(resource_obj['sessions_dir'], f'{session_name}.json')

    # 先看要删的文件在不在
    if not os.path.exists(file_path):
        return ResponseBase(
        code=404,
        message='删除会话失败,没找到对应聊天记录文件',
    )

    # 删除对应文件
    os.remove(file_path)
    return ResponseBase(
        code=200,
        message='删除聊天记录成功',
    )

# -------------------大模型系统提示词
# 1. 模板中的占位符改成 {nick_name} 和 {nature}
default_system_prompt = """
    你叫 {nick_name}，现在是用户的真实伴侣，请完全代入伴侣角色。
    规则：
        1. 每次只回1条消息
        2. 禁止任何场景或状态描述性文字
        3. 匹配用户的语言
        4. 回复简短，像微信聊天一样
        5. 有需要的话可以用❤️🌸等emoji表情
        6. 用符合伴侣性格的方式对话
        7. 回复的内容, 要充分体现伴侣的性格特征
        8. 不要太肉麻（比如想你之类的，就日常聊天）
    伴侣性格：
        - {nature}
    你必须严格遵守上述规则来回复用户。
    """
# 用户传来的请求体格式要求
class ChatRequest(BaseModel):
    session_name:str = Field(description='会话id,默认为时间戳拼的字符串')
    message:str = Field(description='用户传给大模型的消息')
    nick_name:str = Field(default='随便一个名字',description='描述大模型的名称')
    nature:str = Field(default='你是一个助手',description='描述大模型的角色设定')
@app.post('/api/chat',summary='将用户消息拆包发给大模型')
async def send_user_message(request:ChatRequest):
    # 根据前端传来的请求,拼接新的系统提示词
    new_system_prompt = default_system_prompt.format(
        nick_name=request.nick_name,
        nature=request.nature
    )

    # 定义我们需要发给大模型的消息列表,里面封装符合openai接口的对象
    chat_list:list[ChatCompletionMessageParam] = [
        # 0号位置永远是我们的系统提示词
        ChatCompletionSystemMessageParam(role='system', content=new_system_prompt),
    ]

    # 获取目录,加上前端传回的会话id拼成文件路径
    current_session_file_path = os.path.join(resource_obj['sessions_dir'],f'{request.session_name}.json')
    # 打开文件
    with open(file=current_session_file_path,mode='r',encoding='utf-8') as file:
        # 反序列化,拿到json字典
        file_content = json.load(file)
    # 读取文件的message字段
    message_list = file_content.get('message',[])
    # 循环遍历读取到的历史消息
    for item in message_list:
        # 判断角色信息
        if item['role'] == 'user':
            # 拼接进需要发给大模型的list
            chat_list.append(ChatCompletionUserMessageParam(role=item['role'],content=item['content']))
        elif item['role'] == 'assistant':
            chat_list.append(ChatCompletionAssistantMessageParam(role=item['role'],content=item['content']))
        else:
            # 暂时不处理工具的情况
            pass

    # 历史消息拼接完成后,拼接最新的用户消息
    chat_list.append(ChatCompletionUserMessageParam(role="user",content=request.message))

    # print(f'当前拼接完成的消息是:{chat_list}')
    logging.info('当前拼接完成的消息是:%s'% str(chat_list))

    # 创建大模型聊天对象
    chat_app = OpenAI(
        api_key=os.environ.get('DEEPSEEK_API_KEY'),
        base_url="https://api.deepseek.com"
    )

    # 创建聊天对象
    chat_response = chat_app.chat.completions.create(
        # 模型
        model='deepseek-v4-flash',
        # 将拼接好的chat_list传入大模型,每一条dict都是通过Chat提供的类包装后的对象,满足数据格式要求
        messages=chat_list,
        stream=False,
        reasoning_effort="high",
        extra_body={"thinking": {"type": "disabled"}}
    )
    # 拿到模型返回的消息,拼接进消息数组
    chat_list.append(ChatCompletionAssistantMessageParam(role='assistant',content=chat_response.choices[0].message.content))

    # 去掉提示词部分,封装一份需要重新写入的dict,写入文件
    file_content['message'] = [
        # 列表表达式,循环遍历,返回一个字典,循环从下标1开始不包含系统提示词
        {'role': item['role'], 'content': item['content']}
        for item in chat_list[1:]
    ]
    # 更新最新的角色昵称
    file_content['nick_name'] = request.nick_name
    file_content['nature'] = request.nature

    # 旧的file_content已经被覆盖了,重新写入文件
    with open(current_session_file_path,'w',encoding='utf-8') as file:
        json.dump(file_content,file,indent=4,ensure_ascii=False)

    # 封装符合规范的响应体,返回给前端
    return ResponseBase(code=200,message='获取模型消息成功',data=chat_response.choices[0].message.content)


# 主函数运行uvicorn
if __name__ == '__main__':
    uvicorn.run(app,port=1086)