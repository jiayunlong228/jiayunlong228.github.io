# 基于 MkDocs 构建博客

## 一、MkDocs 简介

MkDocs 是一个静态网站生成器，它使用 Markdown（或其他可转换为HTML的格式）来创建项目文档。我的博客使用的是Material主题，页面看起来比较简洁，读者如果想了解更多的主题，可以自行了解并设置。


## 二、创建博客流程
> 以下均在命令行实现

1. 安装 MkDocs 和 Material 主题

```sh
pip install mkdocs # 在python环境下安装mkdocs，目前 MkDocs 支持 Python 3.7 及更高版本。

mkdocs --version # 验证是否安装成功

pip install mkdocs-material # 安装 material 主题
```

2. 创建博客项目

```sh
cd ~

mkdocs new my_blog # 创建一个新项目，并给项目取个名字，这里我使用test作为展示。命令返回内容如下，说明执行成功。
#INFO    -  Creating project directory: test
#INFO    -  Writing config file: test/mkdocs.yml
#INFO    -  Writing initial docs: test/docs/index.md
```

3. 将本地仓库关联到github

先在github



