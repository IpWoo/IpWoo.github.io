---
layout: post
title:  "Unity Job System（文档翻译）"
date:   2023-06-27
categories: jekyll update
---
![Job-System-Blog-Header](https://raw.githubusercontent.com/IpWoo/IpWoo.github.io/gh-pages/docs/image/Job-System-Blog-Header.jpg "Job-System-Blog-Header")

原文连接：<https://docs.unity3d.com/Manual/JobSystem.html>

Job system概述
====
Unity的job system可以让你创建多线程代码，这样你的应用程序可以使用所有可用的CPU核心来执行你的代码。这提供了更好的性能，因为你的应用程序更有效地使用它所运行的所有CPU核心的能力，而不是在一个CPU核心上运行所有代码。

你可以单独使用job system，但为了提高性能，你还应该使用Burst编译器，它是专门为Unity的job system编译jobs而设计的。Burst编译器改进了代码生成，从而提高了性能，减少了移动设备的电池消耗。

你还可以将job system与Unity的ECS一起使用，以创建高性能的面向数据的代码。

# 多线程
Unity使用自己的native job system在多个**工人线程（worker thread）** 上处理自己的原生代码，而这取决于你的应用程序所运行的设备上可用的CPU核的数量。通常，Unity在一个线程上执行你的代码，这个线程默认在程序开始时运行，称为**主线程（main thread）**。然而，当你使用job system时，Unity也可以在工人线程上执行你的代码，这被称为**多线程（multithreading）**。

多线程利用了CPU在多个核心上同时处理大量线程的能力。它们不是一个接一个地执行任务或指令，而是同时运行。job system并行运行，一旦完成，就与主线程同步结果。

job system确保线程与CPU核心的容量相匹配，这意味着你可以根据需要安排尽可能多的jobs，而不需要关心有多少CPU核心可用。这与其他依赖线程池（thread pooling）等技术的作业系统不同，后者可以创建比CPU内核更多的线程但效率比较低。

# 任务偷取（Work stealing）
job system使用任务偷取作为其调度策略的一部分，以平衡工人线程之间的任务量。某个工人线程处理任务的速度可能比其他线程快，所以一旦这个工人线程处理完所有的任务，它就会查看其他工人线程的队列没有处理的任务，然后分配给空闲工人线程。

# 安全系统（Safety system）
为了使编写多线程代码更加容易，job system有一个安全系统，可以检测所有潜在的竞争条件（Race Condition），并保护你免受它们可能导致的错误。当一个操作的输出取决于其控制之外的另一个进程的时间时，就会发生竞争条件。

例如，如果job system将你在主线程中的代码对数据的引用发送给一个job，它无法验证主线程是否在job写入数据的同时读取数据。这种情况会产生一个竞争条件。

为了解决这个问题，job system向每个job发送一份它需要操作的数据的副本，而不是对主线程中数据的引用。这个副本隔离了数据，从而消除了竞争条件。

job system拷贝数据的方式意味着job只能访问blittable数据类型。这些类型在托管代码和本地代码之间传递时不需要转换。

job system使用memcpy来复制blittable类型，并在Unity的托管和本地部分之间传输数据。在调度作业时，它使用memcpy将数据放入本地内存，并在执行jobs时让托管方访问该副本。更多信息，请参阅调度作业（Scheduling jobs）。

Jobs概述
===
一个job是一个小的工作单位，做一个特定的任务。一个job接收参数并对数据进行操作，类似于一个方法调用的行为方式。job可以是独立的，也可以在运行前依赖其他job的完成。在Unity中，job是指任何实现`IJob接口`的结构。

只有主线程可以调度和完成job。它不能访问任何正在运行的job的内容，而且两个job不能同时访问一个job的内容。为了保证job的高效运行，你可以让它们相互依赖。Unity的作业系统允许你创建复杂的依赖链，以确保你的job以正确的顺序完成。

# Jobs类型
* `IJob`： 在一个job线程上运行一个单一的任务。
* `IJobParallelFor`： 并行运行一个任务。每个并行运行的工人线程都有一个独占索引，以安全地访问工作线程之间的共享数据。
* `IJobParallelForTransform`： 并行运行一个任务。每个并行运行的工人线程都有一个独占的Transform，可以从Transform层次结构中进行操作。
* `IJobFor`： 与IJobParallelFor相同，但允许你对任务进行调度，使其不并行运行。

# 线程安全类型
当你将job system与`Burst编译器`一起使用时，它的效果最好。因为Burst不支持托管对象，你需要使用非托管类型来访问jobs中的数据。你可以使用`blittable类型`，或者使用Unity内置的`NativeContainer`对象，它是一个线程安全的C#包装器，用于本地内存。`NativeContainer`对象也允许jobs访问与`主线程`共享的数据，而不是使用一个副本。

# NativeContainers的类型
`Unity.Collections`命名空间包含以下内置的`NativeContainer`对象：

`NativeArray`： 一个非托管数组，它向托管代码暴露了一个本地内存的缓冲区。
`NativeSlice`： 获取`NativeArray`的一个子集，从某个索引位置开始一段长度。
** 注意 **：`Collections包`包含了额外的`NativeContainers`。有关附加类型的完整列表，请参见Collections文档中的Collection类型。

# 读和写访问
默认情况下，当一个job可以访问`NativeContainer`实例时，它有读和写两种访问权限。这种配置会降低性能。这是因为job system不允许你在安排一个对`NativeContainer`实例有写权限的job时，同时安排另一个正在向它写的job。

然而，如果一个job不需要写到`NativeContainer`实例，你可以用`[ReadOnly]`属性标记`NativeContainer`，就像这样：

```csharp
[ReadOnly]
public NativeArray<int> input;
```

在上面的例子中，你可以和其他同样对第一个`NativeArray`有只读权限的job同时执行这个job。

# 内存分配器（Memory allocators）
当你创建一个NativeContainer实例时，你必须指定你需要的内存分配类型。你所使用的分配类型取决于你想让NativeContainer保持多长时间的可用性。这样你就可以定制分配，以便在各种情况下获得最佳性能。

有三种分配器类型用于NativeContainer内存的分配和释放。你必须在实例化一个NativeContainer实例时指定合适的类型：

* Allocator.Temp：最快的分配。使用它来分配生命周期为一帧或更短的内存。你不能使用Temp来传递分配给存储在作业成员字段中的NativeContainer实例。
* Allocator.TempJob： 一个比Temp慢的分配，但比Persistent快。在四帧的生命周期内使用它进行线程安全的分配。重要提示：你必须在四帧内处置这种分配类型，否则控制台会打印出一个警告，由本地代码生成。大多数小型工作都使用这种分配类型。
* Allocator.Persistent： 最慢的分配，但可以根据你的需要持续下去，如果有必要，可以在整个应用程序的生命周期内持续下去。它是一个直接调用malloc的包装器。较长的工作可以使用这种NativeContainer分配类型。在对性能要求很高的地方不要使用Persistent。
比如说：

```csharp
NativeArray<float> result = new NativeArray<float>(1, Allocator.TempJob);
```

注意：上面的例子中的数字1表示NativeArray的大小。在这种情况下，它只有一个数组元素，因为它的结果中只存储了一个数据。

# NativeContainer安全系统
安全系统内置于所有NativeContainer实例中。它跟踪对任何NativeContainer实例的读取或写入，并使用这些信息对NativeContainer的使用强制执行某些规则，使其在多个jobs和线程中以确定的方式行事。

例如，如果两个独立的jobs写到同一个NativeArray，这是不安全的，因为你无法预测哪个job先执行。这意味着你不知道这个job是否会覆盖另一个job的数据。当你调度第二个job时，安全系统会抛出一个异常，并给出明确的错误信息，解释为什么以及如何解决这个问题。

如果你想调度两个job写入同一个NativeContainer实例，你可以用一个依赖关系来调度job。第一个job写入NativeContainer，一旦它执行完毕，下一个job就会安全地读写到同一个NativeContainer。引入依赖关系可以保证jobs总是以一致的顺序执行，并且在NativeContainer中产生的数据是确定性的。

安全系统允许多个job并行地从同一`数据`中读取。

这些读写限制也适用于从主线程访问数据时。例如，如果你试图在写入NativeContainer的job完成之前读取其内容，安全系统会抛出一个错误。同样地，如果你试图在一个NativeContainer的读写job还未完成时就向它写东西，那么安全系统也会抛出一个错误。

另外，由于NativeContainer没有实现ref return，你不能直接改变NativeContainer的内容。例如，`nativeArray[0]++;`和写`var temp = nativeArray[0]; temp++;`是一样的，这并不能更新nativeArray中的值。

相反，你必须将索引中的数据复制到本地的临时副本中，修改该副本，并将其保存回来。比如说：

```csharp
MyStruct temp = myNativeArray[i];
temp.memberVariable = 0;
myNativeArray[i] = temp;
```

# 实现一个自定义的NativeContainer
要实现一个自定义的NativeContainer，你必须用NativeContainer属性来注释你的类型。你还应该了解NativeContainer是如何与安全系统集成的。

有两个主要元素需要实现：

* 使用跟踪： 允许Unity跟踪使用NativeContainer实例的调度jobs，这样它就可以检测并防止潜在的冲突，比如两个jobs同时写入同一个NativeContainer。
* 泄漏跟踪： 检测NativeContainer何时没有被正确销毁（disposed ）。在这种情况下，就会发生内存泄漏，即分配给NativeContainer的内存在程序的整个剩余生命周期中变得不可用。

# 实现使用跟踪
要在你的代码中访问使用情况跟踪，请使用AtomicSafetyHandle类。AtomicSafetyHandle持有对安全系统为特定的NativeContainer存储的中心信息的引用，它是NativeContainer的方法与安全系统互动的主要方式。正因为如此，每个NativeContainer实例必须包含一个名为m_Safety的AtomicSafetyHandle字段。

每个AtomicSafetyHandle都存储了一组标识（flags ），这些标识表明在当前上下文中哪些类型的操作可以在NativeContainer上执行。当一个job包含一个NativeContainer实例时，job system会自动配置AtomicSafetyHandle中的标识，以反映该job中可以使用NativeContainer的方式。

当job试图从NativeContainer实例中读取时，job system会在读取前调用CheckReadAndThrow方法，以确认该job对NativeContainer有读取权限。同样地，当一个job试图写入一个NativeContainer时，job system会在写之前调用CheckWriteAndThrow方法，以确认该job对NativeContainer有写权限。两个被分配到同一NativeContainer实例的job，对该NativeContainer有单独的AtomicSafetyHandle对象，所以尽管它们都引用了同一组中心信息，但它们可以各自持有单独的标识，表明每个job对NativeContainer的读写权限。

# 实现泄漏跟踪
Unity的原生代码实现了泄漏跟踪。它使用UnsafeUtility.MallocTracked方法来分配存储NativeContainer数据所需的内存，然后使用UnsafeUtility.FreeTracked来销毁它。

在Unity的早期版本中，DisposeSentinel类提供了泄漏跟踪。当垃圾收集器收集DisposeSentinel对象时，Unity会报告一个内存泄漏。要创建一个DisposeSentinel，请使用Create方法，它同时也初始化了AtomicSafetyHandle。当你使用这个方法时，你不需要初始化AtomicSafetyHandle。当NativeContainer被销毁时，Dispose方法在一次调用中同时销毁了DisposeSentinel和AtomicSafetyHandle。

为了确定泄漏的NativeContainer是在哪里创建的，你可以捕捉到内存最初分配的堆栈信息。要做到这一点，请使用NativeLeakDetection.Mode属性。你也可以在编辑器中访问这个属性。要做到这一点，进入Preferences > Jobs > Leak Detection Level，并选择你需要的泄漏检测级别。

# 嵌套的NativeContainer
安全系统不支持jobs中嵌套的NativeContainer，因为NativeContainer无法正确配置更大的NativeContainer实例中每个单独的NativeContainer的AtomicSafetyHandle。

为了防止调度使用嵌套的NativeContainer的job，请使用SetNestedContainer，当一个NativeContainer包含其他NativeContainer实例时，它会将其标记为嵌套。

* 安全IDs和错误信息
安全系统提供了错误信息，表明你的代码没有遵守安全约束。为了使错误信息更加清晰，你可以向安全系统注册一个NativeContainer对象的名字。

要注册一个名字，请使用NewStaticSafetyId，它返回一个安全ID，你可以把它传递给SetStaticSafetyId。一旦你创建了一个安全ID，你就可以在NativeContainer的所有实例中重复使用它，所以一个常见的模式是将它存储在容器类的一个静态成员中。

你也可以用SetCustomErrorMessage来覆盖特定的违反安全约束的错误信息。

# 复制NativeContainer结构
NativeContainer是值类型，这意味着当它们被分配到一个变量时，Unity会复制NativeContainer结构，其中包含指向存储NativeContainer数据的指针，包括其AtomicSafetyHandle。它并不复制NativeContainer的全部内容。

这种情况意味着一个NativeContainer结构可能有多个副本，它们都引用了同一个内存区域，并且都包含了引用同一个中央记录的AtomicSafetyHandle对象。

![native-container-diagram](https://github.com/IpWoo/IpWoo.github.io/blob/gh-pages/docs/image/native-container-diagram.png?raw=true "native-container-diagram")
> NativeContainer对象的副本如何工作

上图显示了一个NativeArray结构的三个不同的副本，它们都代表了同一个实际的容器。每个副本都指向相同的存储数据，以及与原始NativeArray相同的安全数据。然而，NativeArray的每个副本都有不同的标志，表明作业被允许对该副本做什么。指向安全数据的指针，结合这些标识，构成了AtomicSafetyHandle。
