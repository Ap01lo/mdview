# mdview 示例文档

这是一个用 **mdview** 渲染 Markdown 的演示文档。挑了一篇技术味儿的内容，看渲染效果。

## 1. 基本排版

Markdown 支持段落、列表、引用、链接。

这是一段例句，多写几行，让你在截图里能看出**行高**、**字号**、**首行缩进**这些排版细节。mdview 的默认字号 15px、行高 1.75、column max-width 720px —— 这个宽度在桌面显示器上阅读非常舒服，左右两边有合适的留白。

- 列表项 1
- 列表项 2：嵌套段落也能正常工作
  1. 有序嵌套
  2. 第二项
- 列表项 3

> 引用块默认左边线 4px、内边距 1em、字体颜色降一档 —— GitHub / Medium 的经典做法。

[GitHub](https://github.com) 链接默认无下划线，鼠标悬停时出现。

## 2. 代码块（含高亮）

```javascript
// 经典的快速排序
function quicksort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.slice(1).filter(x => x < pivot);
  const right = arr.slice(1).filter(x => x >= pivot);
  return [...quicksort(left), pivot, ...quicksort(right)];
}
console.log(quicksort([3, 1, 4, 1, 5, 9, 2, 6]));
```

```python
# Python 实现
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

## 3. LaTeX 公式

行内：著名的勾股定理是 $a^2 + b^2 = c^2$。

行间（display mode）：

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

矩阵：

$$
A = \begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

求和与极限：

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}, \qquad
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$

希腊字母：

$$
\phi, \Phi, \varphi, \pi, \alpha, \beta, \gamma, \theta, \lambda, \mu, \omega
$$

## 4. 三线表（学术风格）

TTS 发展历程：

| 时期 | 技术范式 | 代表性工作 |
|:----:|:------|:-----------|
| 1791-1960s | 机械 / 电子合成 | von Kempelen 说话机、Haskins 实验室 |
| 1960s-1980s | 共振峰合成 | OVE、Klattalk |
| 1980s-2000s | 拼接合成 | MBROLA、FV Music |
| 2000s-2015s | 统计参数合成 | HTS、HMM-based TTS |
| 2017-2021 | 端到端神经网络 | Tacotron、FastSpeech、Transformer-TTS |
| 2021-至今 | 扩散模型 & 大模型 | Vall-E、ChatTTS、DiffSpeech |

## 5. 任务清单

- [x] 文件树浏览
- [x] Markdown 渲染 + 代码高亮
- [x] LaTeX 数学公式
- [x] 主题切换
- [x] 字体设置
- [x] 快捷键自定义
- [ ] 还没想好下一个特性 —— 欢迎提 Issue

---

就这样 —— 一份简单的演示文档。打开任意 mdview 窗口，左侧选这个文件，就能看到上面所有元素的渲染效果。