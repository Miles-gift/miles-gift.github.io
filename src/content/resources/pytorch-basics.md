---
title: "PyTorch 学习记录"
slug: pytorch-basics
description: "我的 PyTorch 原始学习笔记，保留张量、自动微分、网络搭建与训练过程中的代码和说明。"
pubDate: 2026-09-10
resourceType: note
topic: AI 与机器学习
tags: [PyTorch, 深度学习, Python]
sourceKind: personal-note
sourceUrl: ""
language: zh-cn
status: reference
progress: 100
rating: null
lastReviewedAt: 2026-09-10
cover: ""
coverAlt: ""
takeaways: []
draft: false
visibility: public
---

> 这是本人原始学习笔记的公开版本。除移除无法公开访问的本地图片路径并补充站点元数据外，正文保持原有内容与结构。
# PyTorch学习记录

## 一、PyTorch张量

### 创建张量

| **方法**                            | **说明**                                               | **示例代码**                                |
| :---------------------------------- | :----------------------------------------------------- | :------------------------------------------ |
| `torch.tensor(data)`                | 从 Python 列表或 NumPy 数组创建张量。                  | `x = torch.tensor([[1, 2], [3, 4]])`        |
| `torch.zeros(size)`                 | 创建一个全为零的张量。                                 | `x = torch.zeros((2, 3))`                   |
| `torch.ones(size)`                  | 创建一个全为 1 的张量。                                | `x = torch.ones((2, 3))`                    |
| `torch.empty(size)`                 | 创建一个未初始化的张量。                               | `x = torch.empty((2, 3))`                   |
| `torch.rand(size)`                  | 创建一个服从均匀分布的随机张量，值在 `[0, 1)`。        | `x = torch.rand((2, 3))`                    |
| `torch.randn(size)`                 | 创建一个服从正态分布的随机张量，均值为 0，标准差为 1。 | `x = torch.randn((2, 3))`                   |
| `torch.arange(start, end, step)`    | 创建一个一维序列张量，类似于 Python 的 `range`。       | `x = torch.arange(0, 10, 2)`                |
| `torch.linspace(start, end, steps)` | 创建一个在指定范围内等间隔的序列张量。                 | `x = torch.linspace(0, 1, 5)`               |
| `torch.eye(size)`                   | 创建一个单位矩阵（对角线为 1，其他为 0）。             | `x = torch.eye(3)`                          |
| `torch.from_numpy(ndarray)`         | 将 NumPy 数组转换为张量。                              | `x = torch.from_numpy(np.array([1, 2, 3]))` |

### 张量的属性

| **属性**           | **说明**                         | **示例**                 |
| :----------------- | :------------------------------- | :----------------------- |
| `.shape`           | 获取张量的形状                   | `tensor.shape`           |
| `.size()`          | 获取张量的形状                   | `tensor.size()`          |
| `.dtype`           | 获取张量的数据类型               | `tensor.dtype`           |
| `.device`          | 查看张量所在的设备 (CPU/GPU)     | `tensor.device`          |
| `.dim()`           | 获取张量的维度数                 | `tensor.dim()`           |
| `.requires_grad`   | 是否启用梯度计算                 | `tensor.requires_grad`   |
| `.numel()`         | 获取张量中的元素总数             | `tensor.numel()`         |
| `.is_cuda`         | 检查张量是否在 GPU 上            | `tensor.is_cuda`         |
| `.T`               | 获取张量的转置（适用于 2D 张量） | `tensor.T`               |
| `.item()`          | 获取单元素张量的值               | `tensor.item()`          |
| `.is_contiguous()` | 检查张量是否连续存储             | `tensor.is_contiguous()` |

### 张量的操作

#### 基础操作

| **操作**                | **说明**                       | **示例代码**                  |
| :---------------------- | :----------------------------- | :---------------------------- |
| `+`, `-`, `*`, `/`      | 元素级加法、减法、乘法、除法。 | `z = x + y`                   |
| `torch.matmul(x, y)`    | 矩阵乘法。                     | `z = torch.matmul(x, y)`      |
| `torch.dot(x, y)`       | 向量点积（仅适用于 1D 张量）。 | `z = torch.dot(x, y)`         |
| `torch.sum(x)`          | 求和。                         | `z = torch.sum(x)`            |
| `torch.mean(x)`         | 求均值。                       | `z = torch.mean(x)`           |
| `torch.max(x)`          | 求最大值。                     | `z = torch.max(x)`            |
| `torch.min(x)`          | 求最小值。                     | `z = torch.min(x)`            |
| `torch.argmax(x, dim)`  | 返回最大值的索引（指定维度）。 | `z = torch.argmax(x, dim=1)`  |
| `torch.softmax(x, dim)` | 计算 softmax（指定维度）。     | `z = torch.softmax(x, dim=1)` |

#### 形状操作

| `x.view(shape)`          | 改变张量的形状（不改变数据）。 | `z = x.view(3, 4)`             |
| ------------------------ | ------------------------------ | ------------------------------ |
| `x.reshape(shape)`       | 类似于 `view`，但更灵活。      | `z = x.reshape(3, 4)`          |
| `x.t()`                  | 转置矩阵。                     | `z = x.t()`                    |
| `x.unsqueeze(dim)`       | 在指定维度添加一个维度。       | `z = x.unsqueeze(0)`           |
| `x.squeeze(dim)`         | 去掉指定维度为 1 的维度。      | `z = x.squeeze(0)`             |
| `torch.cat((x, y), dim)` | 按指定维度连接多个张量。       | `z = torch.cat((x, y), dim=1)` |



## 二、PyTorch 神经网络基础

### 前馈神经网络（Feedforward Neural Network，FNN）

前馈神经网络（Feedforward Neural Network，FNN）是神经网络家族中的基本单元。

前馈神经网络特点是数据从输入层开始，经过一个或多个隐藏层，最后到达输出层，全过程没有循环或反馈。

![img](https://www.runoob.com/wp-content/uploads/2024/12/neural-net.png)

**前馈神经网络的基本结构：**

- **输入层：** 数据进入网络的入口点。输入层的每个节点代表一个输入特征。
- **隐藏层：**一个或多个层，用于捕获数据的非线性特征。每个隐藏层由多个神经元组成，每个神经元通过激活函数增加非线性能力。
- **输出层：**输出网络的预测结果。节点数和问题类型相关，例如分类问题的输出节点数等于类别数。
- **连接权重与偏置：**每个神经元的输入通过权重进行加权求和，并加上偏置值，然后通过激活函数传递。

### 循环神经网络（Recurrent Neural Network, RNN）

循环神经网络（Recurrent Neural Network, RNN）络是一类专门处理序列数据的神经网络，能够捕获输入数据中时间或顺序信息的依赖关系。

RNN 的特别之处在于它具有"记忆能力"，可以在网络的隐藏状态中保存之前时间步的信息。

循环神经网络用于处理随时间变化的数据模式。

在 RNN 中，相同的层被用来接收输入参数，并在指定的神经网络中显示输出参数。

<img src="https://www.runoob.com/wp-content/uploads/2024/12/0_xs3Dya3qQBx6IU7C.png" alt="img" style="zoom:67%;" />

PyTorch 提供了强大的工具来构建和训练神经网络。

神经网络在 PyTorch 中是通过 **torch.nn** 模块来实现的。

**torch.nn** 模块提供了各种网络层（如全连接层、卷积层等）、损失函数和优化器，让神经网络的构建和训练变得更加方便。

<img src="https://www.runoob.com/wp-content/uploads/2024/12/1_3DUs-90altOgaBcVJ9LTGg.png" alt="img" style="zoom: 50%;" />

在 PyTorch 中，构建神经网络通常需要继承 nn.Module 类。

nn.Module 是所有神经网络模块的基类，你需要定义以下两个部分：

- **`__init__()`**：定义网络层。
- **`forward()`**：定义数据的前向传播过程。

PyTorch 提供了许多常见的神经网络层，以下是几个常见的：

- **`nn.Linear(in_features, out_features)`**：全连接层，输入 `in_features` 个特征，输出 `out_features` 个特征。
- **`nn.Conv2d(in_channels, out_channels, kernel_size)`**：2D 卷积层，用于图像处理。
- **`nn.MaxPool2d(kernel_size)`**：2D 最大池化层，用于降维。
- **`nn.ReLU()`**：ReLU 激活函数，常用于隐藏层。
- **`nn.Softmax(dim)`**：Softmax 激活函数，通常用于输出层，适用于多类分类问题。

### 激活函数（Activation Function）

激活函数决定了神经元是否应该被激活。它们是非线性函数，使得神经网络能够学习和执行更复杂的任务。常见的激活函数包括：

- Sigmoid：用于二分类问题，输出值在 0 和 1 之间。
- Tanh：输出值在 -1 和 1 之间，常用于输出层之前。
- ReLU（Rectified Linear Unit）：目前最流行的激活函数之一，定义为 `f(x) = max(0, x)`，有助于解决梯度消失问题。
- Softmax：常用于多分类问题的输出层，将输出转换为概率分布。

### 损失函数（Loss Function）

损失函数用于衡量模型的预测值与真实值之间的差异。

常见的损失函数包括：

- **均方误差（MSELoss）**：回归问题常用，计算输出与目标值的平方差。
- **交叉熵损失（CrossEntropyLoss）**：分类问题常用，计算输出和真实标签之间的交叉熵。
- **BCEWithLogitsLoss**：二分类问题，结合了 Sigmoid 激活和二元交叉熵损失。

### 优化器（Optimizer）

优化器负责在训练过程中更新网络的权重和偏置。

常见的优化器包括：

- SGD（随机梯度下降）
- Adam（自适应矩估计）
- RMSprop（均方根传播）

| 组件      | 说明                                                 |
| :-------- | :--------------------------------------------------- |
| `MSELoss` | 计算预测值与真实值的均方误差                         |
| `SGD`     | 使用随机梯度下降法更新参数，学习率控制每步更新的幅度 |
| `Adam`    | 自适应学习率优化器，通常收敛更快                     |

### 训练过程（Training Process）

训练神经网络涉及以下步骤：

1. **准备数据**：通过 `DataLoader` 加载数据。
2. **定义损失函数和优化器**。
3. **前向传播**：计算模型的输出。
4. **计算损失**：与目标进行比较，得到损失值。
5. **反向传播**：通过 `loss.backward()` 计算梯度。
6. **更新参数**：通过 `optimizer.step()` 更新模型的参数。
7. **重复上述步骤**，直到达到预定的训练轮数。

### 测试与评估

训练完成后，需要对模型进行测试和评估。

常见的步骤包括：

- **计算测试集的损失**：测试模型在未见过的数据上的表现。
- **计算准确率（Accuracy）**：对于分类问题，计算正确预测的比例。

### 神经网络类型

1. **前馈神经网络（Feedforward Neural Networks）**：数据单向流动，从输入层到输出层，无反馈连接。
2. **卷积神经网络（Convolutional Neural Networks, CNNs）**：适用于图像处理，使用卷积层提取空间特征。
3. **循环神经网络（Recurrent Neural Networks, RNNs）**：适用于序列数据，如时间序列分析和自然语言处理，允许信息反馈循环。
4. **长短期记忆网络（Long Short-Term Memory, LSTM）**：一种特殊的RNN，能够学习长期依赖关系。

## 三、torch.nn 参考

以下是 PyTorch 中最常用的 `torch.nn` 函数和类：

### **模型定义基础**

| **函数**                                                     | **描述**                 | **示例**                                |
| :----------------------------------------------------------- | :----------------------- | :-------------------------------------- |
| [nn.Module](https://www.runoob.com/pytorch/pytorch-torch-nn-module.html) | 所有神经网络模块的基类   | `class Net(nn.Module): ...`             |
| [nn.Sequential](https://www.runoob.com/pytorch/pytorch-torch-nn-sequential.html) | 顺序容器，按顺序执行各层 | `nn.Sequential(conv, relu, pool)`       |
| [nn.ModuleList](https://www.runoob.com/pytorch/pytorch-torch-nn-modulelist.html) | 将子模块存储在列表中     | `self.layers = nn.ModuleList([...])`    |
| [nn.Parameter](https://www.runoob.com/pytorch/pytorch-torch-nn-parameter.html) | 创建可学习的参数张量     | `self.w = nn.Parameter(torch.randn(n))` |

### **卷积层**

| **函数**                                                     | **描述**                   | **示例**                                 |
| :----------------------------------------------------------- | :------------------------- | :--------------------------------------- |
| [nn.Conv1d](https://www.runoob.com/pytorch/pytorch-torch-nn-conv1d.html) | 一维卷积（文本、音频）     | `nn.Conv1d(3, 64, 3)`                    |
| [nn.Conv2d](https://www.runoob.com/pytorch/pytorch-torch-nn-conv2d.html) | 二维卷积（图像）           | `nn.Conv2d(3, 64, 3, padding=1)`         |
| [nn.Conv3d](https://www.runoob.com/pytorch/pytorch-torch-nn-conv3d.html) | 三维卷积（视频）           | `nn.Conv3d(3, 64, 3)`                    |
| [nn.ConvTranspose2d](https://www.runoob.com/pytorch/pytorch-torch-nn-convtranspose2d.html) | 转置卷积（解码器、上采样） | `nn.ConvTranspose2d(64, 3, 2, stride=2)` |

### **池化层**

| **函数**                                                     | **描述**                       | **示例**                       |
| :----------------------------------------------------------- | :----------------------------- | :----------------------------- |
| [nn.MaxPool2d](https://www.runoob.com/pytorch/pytorch-torch-nn-maxpool2d.html) | 二维最大池化                   | `nn.MaxPool2d(2, 2)`           |
| [nn.AvgPool2d](https://www.runoob.com/pytorch/pytorch-torch-nn-avgpool2d.html) | 二维平均池化                   | `nn.AvgPool2d(2, 2)`           |
| [nn.AdaptiveAvgPool2d](https://www.runoob.com/pytorch/pytorch-torch-nn-adaptiveavgpool2d.html) | 自适应平均池化（固定输出尺寸） | `nn.AdaptiveAvgPool2d((1, 1))` |
| [nn.AdaptiveMaxPool2d](https://www.runoob.com/pytorch/pytorch-torch-nn-adaptivemaxpool2d.html) | 自适应最大池化（固定输出尺寸） | `nn.AdaptiveMaxPool2d((1, 1))` |

### **线性层**

| **函数**                                                     | **描述**                             | **示例**                   |
| :----------------------------------------------------------- | :----------------------------------- | :------------------------- |
| [nn.Linear](https://www.runoob.com/pytorch/pytorch-torch-nn-linear.html) | 全连接层（线性变换）                 | `nn.Linear(128, 64)`       |
| [nn.Bilinear](https://www.runoob.com/pytorch/pytorch-torch-nn-bilinear.html) | 双线性层                             | `nn.Bilinear(128, 64, 32)` |
| **函数**                                                     | **描述**                             | **示例**                   |
| [nn.ReLU](https://www.runoob.com/pytorch/pytorch-torch-nn-relu.html) | ReLU 激活函数，f(x) = max(0, x)      | `nn.ReLU()`                |
| [nn.GELU](https://www.runoob.com/pytorch/pytorch-torch-nn-gelu.html) | 高斯误差线性单元（Transformer 默认） | `nn.GELU()`                |
| [nn.SiLU](https://www.runoob.com/pytorch/pytorch-torch-nn-silu.html) | Swish 激活函数                       | `nn.SiLU()`                |
| [nn.Tanh](https://www.runoob.com/pytorch/pytorch-torch-nn-tanh.html) | 双曲正切                             | `nn.Tanh()`                |
| [nn.Sigmoid](https://www.runoob.com/pytorch/pytorch-torch-nn-sigmoid.html) | Sigmoid 激活函数                     | `nn.Sigmoid()`             |
| [nn.Softmax](https://www.runoob.com/pytorch/pytorch-torch-nn-softmax.html) | Softmax 激活函数                     | `nn.Softmax(dim=1)`        |
| [nn.LogSoftmax](https://www.runoob.com/pytorch/pytorch-torch-nn-logsoftmax.html) | Log Softmax（数值稳定）              | `nn.LogSoftmax(dim=1)`     |
| [nn.LeakyReLU](https://www.runoob.com/pytorch/pytorch-torch-nn-leakyrelu.html) | LeakyReLU，允许负值有小幅梯度        | `nn.LeakyReLU(0.01)`       |
| [nn.ELU](https://www.runoob.com/pytorch/pytorch-torch-nn-elu.html) | 指数线性单元                         | `nn.ELU()`                 |

### **归一化层**

| **函数**                                                     | **描述**                     | **示例**                |
| :----------------------------------------------------------- | :--------------------------- | :---------------------- |
| [nn.BatchNorm2d](https://www.runoob.com/pytorch/pytorch-torch-nn-batchnorm2d.html) | 二维批归一化（卷积网络常用） | `nn.BatchNorm2d(64)`    |
| [nn.LayerNorm](https://www.runoob.com/pytorch/pytorch-torch-nn-layernorm.html) | 层归一化（Transformer 常用） | `nn.LayerNorm(512)`     |
| [nn.GroupNorm](https://www.runoob.com/pytorch/pytorch-torch-nn-groupnorm.html) | 组归一化（ResNet 等常用）    | `nn.GroupNorm(4, 64)`   |
| [nn.InstanceNorm2d](https://www.runoob.com/pytorch/pytorch-torch-nn-instancenorm2d.html) | 实例归一化（风格迁移常用）   | `nn.InstanceNorm2d(64)` |

### **循环层**

| **函数**                                                     | **描述**           | **示例**               |
| :----------------------------------------------------------- | :----------------- | :--------------------- |
| [nn.LSTM](https://www.runoob.com/pytorch/pytorch-torch-nn-lstm.html) | LSTM 长短期记忆层  | `nn.LSTM(256, 512, 2)` |
| [nn.GRU](https://www.runoob.com/pytorch/pytorch-torch-nn-gru.html) | GRU 门控循环单元层 | `nn.GRU(256, 512, 2)`  |
| [nn.RNN](https://www.runoob.com/pytorch/pytorch-torch-nn-rnn.html) | 简单 RNN 层        | `nn.RNN(256, 512, 2)`  |

### **Transformer 层**

| **函数**                                                     | **描述**              | **示例**                                     |
| :----------------------------------------------------------- | :-------------------- | :------------------------------------------- |
| [nn.Transformer](https://www.runoob.com/pytorch/pytorch-torch-nn-transformer.html) | 完整 Transformer 模型 | `nn.Transformer(d_model=512, nhead=8)`       |
| [nn.TransformerEncoder](https://www.runoob.com/pytorch/pytorch-torch-nn-transformerencoder.html) | Transformer 编码器    | `nn.TransformerEncoder(layer, num_layers=6)` |
| [nn.TransformerDecoder](https://www.runoob.com/pytorch/pytorch-torch-nn-transformerdecoder.html) | Transformer 解码器    | `nn.TransformerDecoder(layer, num_layers=6)` |
| [nn.TransformerEncoderLayer](https://www.runoob.com/pytorch/pytorch-torch-nn-transformerencoderlayer.html) | Transformer 编码器层  | `nn.TransformerEncoderLayer(512, 8)`         |
| [nn.MultiheadAttention](https://www.runoob.com/pytorch/pytorch-torch-nn-multiheadattention.html) | 多头注意力机制        | `nn.MultiheadAttention(512, 8)`              |

### **嵌入层**

| **函数**                                                     | **描述**                 | **示例**                      |
| :----------------------------------------------------------- | :----------------------- | :---------------------------- |
| [nn.Embedding](https://www.runoob.com/pytorch/pytorch-torch-nn-embedding.html) | 嵌入层（词汇映射到向量） | `nn.Embedding(10000, 256)`    |
| [nn.EmbeddingBag](https://www.runoob.com/pytorch/pytorch-torch-nn-embeddingbag.html) | 嵌入袋（聚合多个嵌入）   | `nn.EmbeddingBag(10000, 256)` |

### **Dropout 层**

| **函数**                                                     | **描述**                   | **示例**            |
| :----------------------------------------------------------- | :------------------------- | :------------------ |
| [nn.Dropout](https://www.runoob.com/pytorch/pytorch-torch-nn-dropout.html) | 随机丢弃（防止过拟合）     | `nn.Dropout(0.5)`   |
| [nn.Dropout2d](https://www.runoob.com/pytorch/pytorch-torch-nn-dropout2d.html) | 2D Dropout（按特征图丢弃） | `nn.Dropout2d(0.5)` |

### **损失函数**

| **函数**                                                     | **描述**                | **示例**                 |
| :----------------------------------------------------------- | :---------------------- | :----------------------- |
| [nn.CrossEntropyLoss](https://www.runoob.com/pytorch/pytorch-torch-nn-crossentropyloss.html) | 交叉熵损失（多分类）    | `nn.CrossEntropyLoss()`  |
| [nn.MSELoss](https://www.runoob.com/pytorch/pytorch-torch-nn-mseloss.html) | 均方误差损失（回归）    | `nn.MSELoss()`           |
| [nn.L1Loss](https://www.runoob.com/pytorch/pytorch-torch-nn-l1loss.html) | L1 损失（MAE）          | `nn.L1Loss()`            |
| [nn.BCEWithLogitsLoss](https://www.runoob.com/pytorch/pytorch-torch-nn-bcewithlogitsloss.html) | 带 Sigmoid 的二元交叉熵 | `nn.BCEWithLogitsLoss()` |
| [nn.HuberLoss](https://www.runoob.com/pytorch/pytorch-torch-nn-huberloss.html) | Huber 损失（鲁棒回归）  | `nn.HuberLoss()`         |
| [nn.NLLLoss](https://www.runoob.com/pytorch/pytorch-torch-nn-nllloss.html) | 负对数似然损失          | `nn.NLLLoss()`           |

### **功能性函数（nn.functional）**

| **函数**          | **描述**          | **示例**                           |
| :---------------- | :---------------- | :--------------------------------- |
| `F.relu`          | ReLU 激活         | `F.relu(x)`                        |
| `F.gelu`          | GELU 激活         | `F.gelu(x)`                        |
| `F.sigmoid`       | Sigmoid 激活      | `F.sigmoid(x)`                     |
| `F.softmax`       | Softmax 激活      | `F.softmax(x, dim=1)`              |
| `F.dropout`       | Dropout 操作      | `F.dropout(x, 0.5, training)`      |
| `F.conv2d`        | 二维卷积          | `F.conv2d(x, weight, bias)`        |
| `F.linear`        | 线性变换          | `F.linear(x, weight, bias)`        |
| `F.cross_entropy` | 交叉熵损失        | `F.cross_entropy(logits, targets)` |
| `F.mse_loss`      | 均方误差损失      | `F.mse_loss(pred, target)`         |
| `F.interpolate`   | 插值（上/下采样） | `F.interpolate(x, scale_factor=2)` |
| `F.embedding`     | 嵌入操作          | `F.embedding(indices, weight)`     |

### **工具函数（nn.init）**

| **函数**                   | **描述**                        | **示例**                                  |
| :------------------------- | :------------------------------ | :---------------------------------------- |
| `nn.init.xavier_uniform_`  | Xavier 均匀初始化               | `nn.init.xavier_uniform_(module.weight)`  |
| `nn.init.xavier_normal_`   | Xavier 正态初始化               | `nn.init.xavier_normal_(module.weight)`   |
| `nn.init.kaiming_uniform_` | Kaiming 均匀初始化（适合 ReLU） | `nn.init.kaiming_uniform_(module.weight)` |
| `nn.init.kaiming_normal_`  | Kaiming 正态初始化（适合 ReLU） | `nn.init.kaiming_normal_(module.weight)`  |
| `nn.init.zeros_`           | 零初始化                        | `nn.init.zeros_(module.bias)`             |
| `nn.init.normal_`          | 正态初始化                      | `nn.init.normal_(module.weight, 0, 0.01)` |

### **工具函数（nn.utils）**

| **函数**                            | **描述**                     | **示例**                                            |
| :---------------------------------- | :--------------------------- | :-------------------------------------------------- |
| `nn.utils.clip_grad_norm_`          | 裁剪梯度范数（防止梯度爆炸） | `nn.utils.clip_grad_norm_(model.parameters(), 1.0)` |
| `nn.utils.weight_norm`              | 权重归一化                   | `nn.utils.weight_norm(module, 'weight')`            |
| `nn.utils.spectral_norm`            | 谱归一化（GAN 常用）         | `nn.utils.spectral_norm(module, 'weight')`          |
| `nn.utils.rnn.pack_padded_sequence` | 打包变长序列                 | `pack_padded_sequence(x, lengths)`                  |
| `nn.utils.rnn.pad_packed_sequence`  | 解包序列                     | `pad_packed_sequence(packed)`                       |

## 四、PyTorch 数据处理与加载

在 PyTorch 中，处理和加载数据是深度学习训练过程中的关键步骤。

为了高效地处理数据，PyTorch 提供了强大的工具，包括 **torch.utils.data.Dataset** 和 **torch.utils.data.DataLoader**，帮助我们管理数据集、批量加载和数据增强等任务。

PyTorch 数据处理与加载的介绍：

- **自定义 Dataset**：通过继承 `torch.utils.data.Dataset` 来加载自己的数据集。
- **DataLoader**：`DataLoader` 按批次加载数据，支持多线程加载并进行数据打乱。
- **数据预处理与增强**：使用 `torchvision.transforms` 进行常见的图像预处理和增强操作，提高模型的泛化能力。
- **加载标准数据集**：`torchvision.datasets` 提供了许多常见的数据集，简化了数据加载过程。
- **多个数据源**：通过组合多个 `Dataset` 实例来处理来自不同来源的数据。

### 自定义 Dataset

**torch.utils.data.Dataset** 是一个抽象类，允许你从自己的数据源中创建数据集。

我们需要继承该类并实现以下两个方法：

- `__len__(self)`：返回数据集中的样本数量。
- `__getitem__(self, idx)`：通过索引返回一个样本。

### 使用 DataLoader 加载数据

DataLoader 是 PyTorch 提供的一个重要工具，用于从 Dataset 中按批次（batch）加载数据。

DataLoader 允许我们批量读取数据并进行多线程加载，从而提高训练效率。

- **`batch_size`**: 每次加载的样本数量。
- **`shuffle`**: 是否对数据进行洗牌，通常训练时需要将数据打乱。
- **`drop_last`**: 如果数据集中的样本数不能被 `batch_size` 整除，设置为 `True` 时，丢弃最后一个不完整的 batch。

### 预处理与数据增强

数据预处理和增强对于提高模型的性能至关重要。

PyTorch 提供了 torchvision.transforms 模块来进行常见的图像预处理和增强操作，如旋转、裁剪、归一化等。

常见的图像预处理操作:

- **`transforms.Compose()`**：将多个变换操作组合在一起。
- **`transforms.Resize()`**：调整图像大小。
- **`transforms.ToTensor()`**：将图像转换为 PyTorch 张量，值会被归一化到 `[0, 1]` 范围。
- **`transforms.Normalize()`**：标准化图像数据，通常使用预训练模型时需要进行标准化处理。

#### 图像数据增强

数据增强技术通过对训练数据进行随机变换，增加数据的多样性，帮助模型更好地泛化。例如，随机翻转、旋转、裁剪等。

这些数据增强方法可以通过 transforms.Compose() 组合使用，保证每个图像在训练时具有不同的变换。

### 加载图像数据集

对于图像数据集，torchvision.datasets 提供了许多常见数据集（如 CIFAR-10、ImageNet、MNIST 等）以及用于加载图像数据的工具。

- `datasets.MNIST()` 会自动下载 MNIST 数据集并加载。
- `transform` 参数允许我们对数据进行预处理。
- `train=True` 和 `train=False` 分别表示训练集和测试集。

## 五、PyTorch 数据集、

在深度学习任务中，数据加载和处理是至关重要的一环。

PyTorch 提供了强大的数据加载和处理工具，主要包括：

- **`torch.utils.data.Dataset`**：数据集的抽象类，需要自定义并实现 `__len__`（数据集大小）和 `__getitem__`（按索引获取样本）。
- **`torch.utils.data.TensorDataset`**：基于张量的数据集，适合处理数据-标签对，直接支持批处理和迭代。
- **`torch.utils.data.DataLoader`**：封装 Dataset 的迭代器，提供批处理、数据打乱、多线程加载等功能，便于数据输入模型训练。
- **`torchvision.datasets.ImageFolder`**：从文件夹加载图像数据，每个子文件夹代表一个类别，适用于图像分类任务。

### PyTorch 内置数据集

PyTorch 通过 torchvision.datasets 模块提供了许多常用的数据集，例如：

- **MNIST**：手写数字图像数据集，用于图像分类任务。
- **CIFAR**：包含 10 个类别、60000 张 32x32 的彩色图像数据集，用于图像分类任务。
- **COCO**：通用物体检测、分割、关键点检测数据集，包含超过 330k 个图像和 2.5M 个目标实例的大规模数据集。
- **ImageNet**：包含超过 1400 万张图像，用于图像分类和物体检测等任务。
- **STL-10**：包含 100k 张 96x96 的彩色图像数据集，用于图像分类任务。
- **Cityscapes**：包含 5000 张精细注释的城市街道场景图像，用于语义分割任务。
- **SQUAD**：用于机器阅读理解任务的数据集。

以上数据集可以通过 torchvision.datasets 模块中的函数进行加载，也可以通过自定义的方式加载其他数据集。

### torchvision 和 torchtext

- **torchvision**： 一个图形库，提供了图片数据处理相关的 API 和数据集接口，包括数据集加载函数和常用的图像变换。

- **torchtext**： 自然语言处理工具包，提供了文本数据处理和建模的工具，包括数据预处理和数据加载的方式。

### torch.utils.data.Dataset

Dataset 是 PyTorch 中用于数据集抽象的类。

自定义数据集需要继承 torch.utils.data.Dataset 并重写以下两个方法：

- `__len__`：返回数据集的大小。
- `__getitem__`：按索引获取一个数据样本及其标签。

### torch.utils.data.DataLoader

DataLoader 是 PyTorch 提供的数据加载器，用于批量加载数据集。

提供了以下功能：

- **批量加载**：通过设置 `batch_size`。
- **数据打乱**：通过设置 `shuffle=True`。
- **多线程加速**：通过设置 `num_workers`。
- **迭代访问**：方便地按批次访问数据。

## 六、PyTorch Transformer
