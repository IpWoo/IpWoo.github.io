---
layout: post
title:  "Unity Job System（文档翻译）"
date:   2023-06-27
categories: jekyll update
---
![Job-System-Blog-Header](https://raw.githubusercontent.com/IpWoo/IpWoo.github.io/gh-pages/docs/image/Job-System-Blog-Header.jpg "Job-System-Blog-Header")

原文连接：<https://docs.unity3d.com/Manual/JobSystem.html>

### Job system概述
***

Unity的job system可以创建多线程代码，这样的程序可以使用所有可用的CPU核心来执行代码。由于程序可以更有效地使用所有CPU核心，而不是在一个CPU核心上运行代码，所以提供了更好的性能。

job system可以单独使用，同时还可以使用Burst编译器进一步提高性能，它是专门为编译Unity的job systemjobs而设计的。Burst编译器优化了生成的代码，从而提高了性能，减少了移动设备的电池消耗。

job system可以与Unity的ECS一起使用，以创建高性能的面向数据的代码。

#### 多线程
Unity可以使用内置的native job system在多个**工人线程（worker thread）** 上处理引擎的原生代码，而这取决于程序所运行的设备上可用的CPU核的数量。通常，Unity只在一个线程上执行代码，这个线程默认在程序开始时运行，称为**主线程（main thread）**。然而，当你使用job system时，Unity也可以在工人线程上执行你的代码，这被称为**多线程（multithreading）**。

多线程利用了CPU在多个核心上可以同时处理大量线程的能力。它们不是一个接一个地执行任务或指令，而是同时运行。job system便是并行运行，一旦完成，就与主线程同步结果。

job system确保线程与CPU核心的容量相匹配，这意味着可以根据需求尽可能多的调度jobs，而不需要关心有多少CPU核心可用。这与其他依赖线程池（thread pooling）等技术的作业系统不同，后者可以创建比CPU内核更多的线程但效率比较低。

> 译者注：线程数多于 CPU 核心数会导致线程相互竞争 CPU 资源，进而造成频繁的上下文切换。上下文切换是这样一个过程：在执行过程的中途保存一个线程的状态，然后处理另一个线程，再然后重建第一个线程以继续处理该线程。上下文切换是资源密集型的过程，因此应尽可能避免。

#### 任务偷取（Work stealing）
job system使用任务偷取作为其调度策略的一部分，以平衡工人线程之间的任务量。某个工人线程处理任务的速度可能比其他线程快，所以一旦这个工人线程处理完所有的任务，它就会查看其他工人线程的队列没有处理的任务，然后分配给空闲工人线程。

#### 安全系统（Safety system）
为了更加容易地编写多线程代码，job system有一个安全系统，可以检测潜在的竞争条件（Race Condition），以避免的错误。当一个操作的输出依赖于不受其控制的另一个进程时，就会发生竞争条件。。

例如，如果job system将主线程中的某个数据的引用发送给一个job，它无法确认主线程是否在job写入数据的同时读取数据。这时会产生一个竞争条件。

为了解决这个问题，job system向每个job发送数据时发送的是这块数据的副本，而不是这块数据的引用。这个副本与数据相隔离，从而消除了竞争条件。

job system拷贝数据的方式意味着job只能访问blittable数据类型。这种数据类型在托管代码和本地代码之间相互传递时不需要转换过程。

job system使用memcpy来复制blittable类型，并在Unity的托管和本地部分之间传输数据。在调度jobs时，它使用memcpy将数据放入本地内存，并在执行jobs时让托管方访问该副本。更多信息，请参阅调度jobs（Scheduling jobs）。

### Jobs概述
***

一个job是一个小的工作单位，执行一个特定的任务。一个job接收参数并对数据进行操作，类似于一个方法调用。job可以独立执行，也可以在执行前依赖其他job的完成。在Unity中，job是指任何实现`IJob接口`的结构。

只有主线程可以调度和完成job。它不能访问任何正在运行的job的内容，而且两个jobs不能同时访问一个job的内容。为了保证job的高效运行，可以让它们相互依赖。Unity的job system允许创建复杂的依赖链，以确保job以正确的顺序执行。

#### Jobs类型
* `IJob`： 在一个job线程上运行一个单一的任务。
* `IJobParallelFor`： 并行运行一个任务。每个并行运行的工人线程都有一个独占索引，以安全地访问工作线程之间的共享数据。
* `IJobParallelForTransform`： 并行运行一个任务。每个并行运行的工人线程都有一个独占的Transform，可以从Transform层次结构中进行操作。
* `IJobFor`： 与IJobParallelFor相同，但允许你对任务进行调度，使其不并行运行。

### 线程安全的类型
***

当你将job system与`Burst编译器`一起使用时效果最好。因为Burst不支持托管对象，你需要使用非托管类型来访问jobs中的数据。你可以使用`blittable类型`，或者使用Unity内置的`NativeContainer`对象，它是一个线程安全的C#包装器，用于本地内存。`NativeContainer`对象也允许jobs访问与`主线程`共享的数据，而不是使用一个副本。

#### NativeContainers的类型
`Unity.Collections`命名空间包含以下内置的`NativeContainer`对象：

`NativeArray`： 一个非托管数组，它向托管代码暴露了一个本地内存的缓冲区。
`NativeSlice`： 获取`NativeArray`的一个子集，返回从某个索引位置开始一段长度的数组。
** 注意 **：`Collections包`包含了额外的`NativeContainers`。有关附加类型的完整列表，请参见Collections文档中的Collection类型。

#### 读和写访问
默认情况下，当一个job可以访问`NativeContainer`实例时，它有读和写两种访问权限。这种配置会降低性能。这是因为job system不允许调度一个对`NativeContainer`实例有写权限的job时，同时调度另一个正在向它写的job。

然而，如果一个job不需要写到`NativeContainer`实例，可以用`[ReadOnly]`属性标记`NativeContainer`，就像这样：

```csharp
[ReadOnly]
public NativeArray<int> input;
```

在上面的例子中，可以和其他对这个`NativeArray`有只读权限的job同时执行。

#### 内存分配器（Memory allocators）
创建一个NativeContainer实例时，必须指定需要的内存分配类型。你所使用的分配类型决定了NativeContainer的生命周期。可以选择不同的分配类型在各种情况下获得最佳性能。

NativeContainer用三种分配器类型去控制内存的分配和释放。必须在实例化NativeContainer实例时指定合适的类型：

* Allocator.Temp：最快的分配。只有一帧或更短的生命周期为。你不能使用Temp来传递分配给存储在作业成员字段中的NativeContainer实例。
* Allocator.TempJob： 一个比Temp慢的分配，但比Persistent快。在4帧的生命周期内使用它进行线程安全的分配。重要提示：你必须在4帧内销毁这种分配类型，否则控制台会打印出一个警告，由本地代码生成。大多数小型工作都使用这种分配类型。
* Allocator.Persistent： 最慢的分配，但可以根据的需要保持，可以在整个应用程序的生命周期内保持。它是一个直接调用malloc的包装器。较长的工作可以使用这种NativeContainer分配类型。在对性能要求很高的地方不要使用Persistent。

```csharp
NativeArray<float> result = new NativeArray<float>(1, Allocator.TempJob);
```

注意：上面的例子中的数字1表示NativeArray的大小。在这种情况下，它是只有一个元素的数组，因为它的结果中只存储了一个数据。

#### NativeContainer安全系统
安全系统内置于所有NativeContainer实例中。它跟踪对任何NativeContainer实例的读取或写入，并使用这些信息对NativeContainer的使用强制执行某些规则，使其在多个jobs和线程中以确定的方式运行。

例如，如果两个独立的jobs写入同一个NativeArray是不安全的，因为无法预测哪个job先执行。这意味着不知道这个job是否会覆盖另一个job的数据。当调度第二个job时，安全系统会抛出一个异常，并给出明确的错误信息，解释为什么以及如何解决这个问题。

如果想调度两个job写入同一个NativeContainer实例，可以用一个依赖关系来调度job。第一个job写入NativeContainer，一旦它执行完毕，下一个job就会安全地读写同一个NativeContainer。引入依赖关系可以保证jobs总是以一致的顺序执行，并且在NativeContainer中产生的数据是确定性的。

安全系统允许多个job并行地*** 读取 ***同一数据。

这些读写限制也适用于从主线程访问数据时。例如，如果你试图在写入NativeContainer的job完成之前读取其内容，安全系统会抛出一个错误。同样地，如果你试图在一个NativeContainer的读写job还未完成时就向它写东西，那么安全系统也会抛出一个错误。

另外，由于NativeContainer没有实现引用 return，你不能直接改变NativeContainer的内容。例如，`nativeArray[0]++;`和`var temp = nativeArray[0]; temp++;`是一样的，这并不能更新nativeArray中的值。

所以，必须将索引中的数据复制到本地的临时副本中，修改该副本，再将其保存回去。比如说：

```csharp
MyStruct temp = myNativeArray[i];
temp.memberVariable = 0;
myNativeArray[i] = temp;
```

### 实现一个自定义的NativeContainer
***

要实现一个自定义的NativeContainer，你必须用NativeContainer的特性（attribute）来注解类型。你还应该了解NativeContainer是如何与安全系统集成的。

有两个主要元素需要实现：

* 使用跟踪： 允许Unity跟踪使用NativeContainer实例调度的jobs，以便检测并防止潜在的冲突，比如两个jobs同时写入同一个NativeContainer。
* 泄漏跟踪： 检测NativeContainer何时没有被正确销毁（disposed ）。发生内存泄漏的情况下，分配给NativeContainer的内存在程序剩余生命周期中将变得不可用。

#### 实现使用跟踪
实现使用情况跟踪，请使用AtomicSafetyHandle类。AtomicSafetyHandle持有对安全系统为特定的NativeContainer存储的中心信息的引用，它是NativeContainer的方法与安全系统互动的主要方式。正因为如此，每个NativeContainer实例必须包含一个名为m_Safety的AtomicSafetyHandle类型字段。

每个AtomicSafetyHandle都存储了一组标识（flags ），这些标识表明在当前上下文中哪些类型的操作可以在NativeContainer上执行。当一个job包含一个NativeContainer实例时，job system会自动配置AtomicSafetyHandle中的标识，以反映该job中可以使用NativeContainer的方式。

当job试图从NativeContainer实例中读取时，job system会在读取前调用CheckReadAndThrow方法，以确认该job对NativeContainer有读取权限。同样地，当一个job试图写入一个NativeContainer时，job system会在写之前调用CheckWriteAndThrow方法，以确认该job对NativeContainer有写权限。两个被分配到同一NativeContainer实例的job，对该NativeContainer有单独的AtomicSafetyHandle对象，所以尽管它们都引用了同一组中心信息，但它们可以各自持有单独的标识，表明每个job对NativeContainer的读写权限。

#### 实现泄漏跟踪
Unity的原生代码实现了泄漏跟踪。它使用UnsafeUtility.MallocTracked方法来分配存储NativeContainer数据所需的内存，然后使用UnsafeUtility.FreeTracked来销毁它。

在Unity的早期版本中，DisposeSentinel类提供了泄漏跟踪。当垃圾收集器收集DisposeSentinel对象时，Unity会报告一个内存泄漏。要创建一个DisposeSentinel，请使用Create方法，它同时也初始化了AtomicSafetyHandle。当你使用这个方法时，你不需要初始化AtomicSafetyHandle。当NativeContainer被销毁时，Dispose方法在一次调用中同时销毁了DisposeSentinel和AtomicSafetyHandle。

为了确定泄漏的NativeContainer是在哪里创建的，你可以捕捉到内存最初分配的堆栈信息。要做到这一点，请使用NativeLeakDetection.Mode属性。你也可以在编辑器中访问这个属性。要做到这一点，进入Preferences > Jobs > Leak Detection Level，并选择你需要的泄漏检测级别。

#### 嵌套的NativeContainer
安全系统不支持jobs中嵌套的NativeContainer，因为NativeContainer无法正确配置更大的NativeContainer实例中每个单独的NativeContainer的AtomicSafetyHandle。

为了防止调度使用嵌套的NativeContainer的job，请使用SetNestedContainer，当一个NativeContainer包含其他NativeContainer实例时，它会将其标记为嵌套。

#### 安全IDs和错误信息
安全系统提供了错误信息，表明你的代码没有遵守安全约束。为了使错误信息更加清晰，你可以向安全系统注册一个NativeContainer对象的名字。

要注册一个名字，请使用NewStaticSafetyId，它返回一个安全ID，你可以把它传递给SetStaticSafetyId。一旦你创建了一个安全ID，你就可以在NativeContainer的所有实例中重复使用它，所以一个常见的模式是将它存储在容器类的一个静态成员中。

你也可以用SetCustomErrorMessage来覆盖特定的违反安全约束的错误信息。

### 复制NativeContainer结构
***

NativeContainer是值类型，这意味着当它们被分配到一个变量时，Unity会复制NativeContainer结构，其中包含指向存储NativeContainer数据的指针，包括其AtomicSafetyHandle。它并不复制NativeContainer的全部内容。

这种情况意味着一个NativeContainer结构可能有多个副本，它们都引用了同一个内存区域，并且都包含了引用同一个中央记录的AtomicSafetyHandle对象。

![native-container-diagram](https://github.com/IpWoo/IpWoo.github.io/blob/gh-pages/docs/image/native-container-diagram.png?raw=true "native-container-diagram")
> NativeContainer对象的副本如何工作

上图显示了一个NativeArray结构的三个不同的副本，它们都代表了同一个实际的容器。每个副本都指向相同的存储数据，以及与原始NativeArray相同的安全数据。然而，NativeArray的每个副本都有不同的标志，表明作业被允许对该副本做什么。指向安全数据的指针，结合这些标识，构成了AtomicSafetyHandle。

#### 版本号
如果一个NativeContainer被销毁了，所有NativeContainer结构的副本都必须知道到原始NativeContainer是无效的。销毁原始的NativeContainer意味着用来存放NativeContainer数据的内存块已经被释放。在这种情况下，存储在每个NativeContainer副本中的数据指针是无效的，使用它可能会导致访问违规。

AtomicSafetyHandle还指向一个中央记录，该记录对于NativeContainer实例来说变得无效。然而，安全系统从不为中央记录去分配内存，所以它避免了访问违规的风险。

相反，每个记录都包含一个版本号。每个引用该记录的AtomicSafetyHandle中都有一个版本号的副本。当一个NativeContainer被销毁时，Unity会调用Release()，它将增加中央记录的版本号。在这之后，该记录可以被其他NativeContainer实例重新使用。

每个剩余的AtomicSafetyHandle将其存储的版本号与中央记录中的版本号进行比较，以测试NativeContainer是否已经被销毁。作为对CheckReadAndThrow和CheckWriteAndThrow等方法的调用的一部分，Unity会自动执行这个测试。

#### 动态ativeContainer的静态视图
一个动态NativeContainer是一个具有可变大小的容器，可以不断向其添加元素，比如NativeList<T>（可在Collections包中找到）。这与NativeArray<T>这样的静态NativeContainer相反，后者只有一个固定的大小，不能改变。

当你使用一个动态NativeContainer时，你也可以通过另一个接口（称为视图）直接访问它的数据。视图允许你对NativeContainer对象的数据进行别名，而不需要复制或获取数据的所有权。视图的例子包括枚举器对象，你可以用它来逐个访问NativeContainer中的数据，诸如NativeList<T>.AsArray的方法，你可以用它来把NativeList当作NativeArray。

如果动态NativeContainer的大小发生变化，视图通常不是线程安全的。这是因为当NativeContainer的大小发生变化时，Unity会重新定位数据在内存中的存储位置，这会导致视图存储的任何指针变得无效。

#### 二级版本号
为了支持动态NativeContainer的大小发生变化的情况，安全系统在AtomicSafetyHandle中包括一个二级版本号。这个机制类似于版本划分机制，但是使用了存储在中央记录中的第二个版本号，它可以独立于第一个版本号进行递增。

为了使用二级版本号，你可以使用UseSecondaryVersion来将视图配置到存储在NativeContainer中的数据中。对于改变Native容器大小的操作，或以其他方式使现有的视图无效，使用CheckWriteAndBumpSecondaryVersion而不是CheckWriteAndThrow。你还需要在NativeContainer上设置SetBumpSecondaryVersionOnScheduleWrite，以便在计划向NativeContainer写入作业时自动使视图失效。

当你创建一个视图并将AtomicSafetyHandle复制到它时，使用CheckGetSecondaryDataPointerAndThrow来确认将指向NativeContainer的内存的指针复制到视图中是安全的。

#### 特殊句柄
有两个特殊的句柄，你可以在处理临时NativeContainer时使用：

* GetTempMemoryHandle： 返回一个AtomicSafetyHandle，你可以在用Allocator.Temp分配的NativeContainer中使用。当当前临时内存范围退出时，Unity会自动使这个句柄失效，所以你不需要自己释放它。要测试一个特定的AtomicSafetyHandle是否是GetTempMemoryHandle返回的句柄，使用IsTempMemoryHandle。
* GetTempUnsafePtrSliceHandle： 返回一个全局句柄，你可以用于由不安全内存支持的临时NativeContainer。例如，一个由堆栈内存构建的NativeSlice。你不能把使用这个句柄的容器传递给job。

### 自定义NativeContainer示例
***

下面是一个完整的自定义NativeContainer的例子，作为一个append-only list。它演示了读和写操作的基本保护，以及创建和失效别名视图。还有另一个例子，请看NativeContainerAttribute API文档。

```csharp
using System;
using System.Runtime.InteropServices;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Collections;

// Marks the struct as a NativeContainer. This tells the job system that it contains an AtomicSafetyHandle.
[NativeContainer]
public unsafe struct NativeAppendOnlyList<T> : IDisposable where T : unmanaged
{
    // Raw pointers aren't usually allowed inside structures that are passed to jobs, but because it's protected
    // with the safety system, you can disable that restriction for it
    [NativeDisableUnsafePtrRestriction]
    internal void* m_Buffer;
    internal int m_Length;
    internal Allocator m_AllocatorLabel;

    // You should only declare and use safety system members with the ENABLE_UNITY_COLLECTIONS_CHECKS define.
    // In final builds of projects, the safety system is disabled for performance reasons, so these APIs aren't
    // available in those builds.
#if ENABLE_UNITY_COLLECTIONS_CHECKS
    
    // The AtomicSafetyHandle field must be named exactly 'm_Safety'.
    internal AtomicSafetyHandle m_Safety;
    
    // Statically register this type with the safety system, using a name derived from the type itself
    internal static readonly int s_staticSafetyId = AtomicSafetyHandle.NewStaticSafetyId<NativeAppendOnlyList<T>>();
#endif

    public NativeAppendOnlyList(Allocator allocator, params T[] initialItems)
    {
        m_Length = initialItems.Length;
        m_AllocatorLabel = allocator;

        // Calculate the size of the initial buffer in bytes, and allocate it
        int totalSize = UnsafeUtility.SizeOf<T>() * m_Length;
        m_Buffer = UnsafeUtility.MallocTracked(totalSize, UnsafeUtility.AlignOf<T>(), m_AllocatorLabel, 1);

        // Copy the data from the array into the buffer
        var handle = GCHandle.Alloc(initialItems, GCHandleType.Pinned);
        try
        {
            UnsafeUtility.MemCpy(m_Buffer, handle.AddrOfPinnedObject().ToPointer(), totalSize);
        }
        finally
        {
            handle.Free();
        }

#if ENABLE_UNITY_COLLECTIONS_CHECKS
        // Create the AtomicSafetyHandle and DisposeSentinel
        m_Safety = AtomicSafetyHandle.Create();

        // Set the safety ID on the AtomicSafetyHandle so that error messages describe this container type properly.
        AtomicSafetyHandle.SetStaticSafetyId(ref m_Safety, s_staticSafetyId);
        
        // Automatically bump the secondary version any time this container is scheduled for writing in a job
        AtomicSafetyHandle.SetBumpSecondaryVersionOnScheduleWrite(m_Safety, true);

        // Check if this is a nested container, and if so, set the nested container flag
        if (UnsafeUtility.IsNativeContainerType<T>()) 
            AtomicSafetyHandle.SetNestedContainer(m_Safety, true);
#endif
    }

    public int Length
    {
        get
        {
#if ENABLE_UNITY_COLLECTIONS_CHECKS
            // Check that you are allowed to read information about the container 
            // This throws InvalidOperationException if you aren't allowed to read from the native container,
            // or if the native container has been disposed
            AtomicSafetyHandle.CheckReadAndThrow(m_Safety);
#endif
            return m_Length;
        }
    }

    public T this[int index]
    {
        get
        {
#if ENABLE_UNITY_COLLECTIONS_CHECKS
            // Check that you can read from the native container right now.
            AtomicSafetyHandle.CheckReadAndThrow(m_Safety);
#endif

            // Read from the buffer and return the value
            return UnsafeUtility.ReadArrayElement<T>(m_Buffer, index);
        }

        set
        {
#if ENABLE_UNITY_COLLECTIONS_CHECKS
            // Check that you can write to the native container right now.
            AtomicSafetyHandle.CheckWriteAndThrow(m_Safety);
#endif
            // Write the value into the buffer
            UnsafeUtility.WriteArrayElement(m_Buffer, index, value);
        }
    }

    public void Add(T value)
    {
#if ENABLE_UNITY_COLLECTIONS_CHECKS
        // Check that you can modify (write to) the native container right now, and if so, bump the secondary version so that
        // any views are invalidated, because you are going to change the size and pointer to the buffer
        AtomicSafetyHandle.CheckWriteAndBumpSecondaryVersion(m_Safety);
#endif

        // Replace the current buffer with a new one that has space for an extra element
        int newTotalSize = (m_Length + 1) * UnsafeUtility.SizeOf<T>();
        void* newBuffer = UnsafeUtility.MallocTracked(newTotalSize, UnsafeUtility.AlignOf<T>(), m_AllocatorLabel, 1);
        UnsafeUtility.MemCpy(newBuffer, m_Buffer, m_Length * UnsafeUtility.SizeOf<T>());
        UnsafeUtility.FreeTracked(m_Buffer, m_AllocatorLabel);
        m_Buffer = newBuffer;
        
        // Put the new element at the end of the buffer and increase the length
        UnsafeUtility.WriteArrayElement(m_Buffer, m_Length++, value);
    }

    public NativeArray<T> AsArray()
    {
#if ENABLE_UNITY_COLLECTIONS_CHECKS
        // Check that it's safe for you to use the buffer pointer to construct a view right now.
        AtomicSafetyHandle.CheckGetSecondaryDataPointerAndThrow(m_Safety);
        
        // Make a copy of the AtomicSafetyHandle, and mark the copy to use the secondary version instead of the primary
        AtomicSafetyHandle handleForArray = m_Safety;
        AtomicSafetyHandle.UseSecondaryVersion(ref handleForArray);
#endif

        // Create a new NativeArray which aliases the buffer, using the current size. This doesn't allocate or copy
        // any data, it just sets up a NativeArray<T> which points at the m_Buffer.
        var array = NativeArrayUnsafeUtility.ConvertExistingDataToNativeArray<T>(m_Buffer, m_Length, Allocator.None);
        
#if ENABLE_UNITY_COLLECTIONS_CHECKS
        // Set the AtomicSafetyHandle on the newly created NativeArray to be the one that you copied from your handle
        // and made to use the secondary version.
        NativeArrayUnsafeUtility.SetAtomicSafetyHandle(ref array, handleForArray);
#endif
        
        return array;
    }

    public void Dispose()
    {
#if ENABLE_UNITY_COLLECTIONS_CHECKS
        AtomicSafetyHandle.CheckDeallocateAndThrow(m_Safety);
        AtomicSafetyHandle.Release(m_Safety);
#endif

        // Free the buffer
        UnsafeUtility.FreeTracked(m_Buffer, m_AllocatorLabel);
        m_Buffer = null;
        m_Length = 0;
    }
}
```

### 创建和运行一个job
*** 

要创建并成功运行一个job，你必须做以下工作：

* 创建一个job： 实现IJob接口。
* 调度job： 调用job的 Schedule方法。
* 等待job完成： 如果job已经完成，它会立即返回，当想访问数据时，可以调用job的Complete方法。

#### 创建一个job
要在Unity中创建一个job，需要实现IJob接口。可以使用IJob实现来调度一个单独的job，与任何其他正在运行的job并行运行。

IJob有一个必须实现的方法： Execute，每当工人线程运行job时，Unity都会调用该方法。

当创建一个job时，可以为它创建一个JobHandle，其他方法需要用它来引用这个job。

*** 重要提示 ***：没有任何措施可以保护从job中访问非只读或可变的静态数据。访问这类数据会规避所有的安全系统，可能会使程序或Unity编辑器崩溃。

当Unity运行时，job system会对调度中的job数据进行复制，这可以防止一个以上的线程读取或写入相同的数据。只有写入NativeContainer的数据在job完成后才能被访问。这是因为job使用的NativeContainer副本和原始的NativeContainer对象都指向同一个内存。欲了解更多信息，请参见线程安全类型的文档。

当job system从它的jobs队列中取出一个job时，它会在一个单线程上运行一次Execute方法。通常情况下，job system在后台线程上运行job，但如果主线程变得空闲，它也可以选择主线程。出于这个原因，应该把job设计成在一帧内完成。


调度一个job
要调度一个job，请调用Schedule。这将job放入jobs队列中，一旦所有的依赖关系（如果有的话）完成，job system就会开始执行该job。一旦调度了job，就不能中断job。只能在主线程中调用Schedule。

提示： job有一个Run方法，可以用它来代替Schedule，在主线程上立即执行job。可以用它来进行调试。

完成job
一旦你调用Schedule，并且job system已经执行了一个job，可以调用JobHandle上的Complete方法来访问job中的数据。最好的做法是在代码中尽可能晚地调用Complete。当调用Complete时，主线程可以安全地访问job所使用的NativeContainer实例。调用Complete还可以清理安全系统中的状态。否则会导致内存泄漏。

job示例
下面是一个将两个浮点数值相加的job的例子。它实现了IJob，使用NativeArray来获取job的结果，并使用Execute方法来实现里面的job：

```csharp
using UnityEngine;
using Unity.Collections;
using Unity.Jobs;

// Job adding two floating point values together
public struct MyJob : IJob
{
    public float a;
    public float b;
    public NativeArray<float> result;

    public void Execute()
    {
        result[0] = a + b;
    }
}
```
下面的例子是在MyJob基础上，在主线程上调度一个job：

```csharp
using UnityEngine;
using Unity.Collections;
using Unity.Jobs;

public class MyScheduledJob : MonoBehaviour
{
    // Create a native array of a single float to store the result. Using a 
    // NativeArray is the only way you can get the results of the job, whether
    // you're getting one value or an array of values.
    NativeArray<float> result;
    // Create a JobHandle for the job
    JobHandle handle;

    // Set up the job
    public struct MyJob : IJob
    {
        public float a;
        public float b;
        public NativeArray<float> result;

        public void Execute()
        {
            result[0] = a + b;
        }
    }

    // Update is called once per frame
    void Update()
    {
        // Set up the job data
        result = new NativeArray<float>(1, Allocator.TempJob);

        MyJob jobData = new MyJob
        {
            a = 10,
            b = 10,
            result = result
        };

        // Schedule the job
        handle = jobData.Schedule();
    }

    private void LateUpdate()
    {
        // Sometime later in the frame, wait for the job to complete before accessing the results.
        handle.Complete();

        // All copies of the NativeArray point to the same memory, you can access the result in "your" copy of the NativeArray
        // float aPlusB = result[0];

        // Free the memory allocated by the result array
        result.Dispose();
    }


}
```

#### 调度和完成的最佳实践
最好的做法是，一旦你有了job所需的数据，就立即调用Schedule，直到你需要结果时才调用完成。

可以在一个不与更重要的job竞争的帧的某段时间调度不太重要的job。

例如，如果在一帧结束和下一帧开始之间有一段时间没有job在运行，可以把job安排在一帧结束时，在下一帧访问其结果，通常延迟一帧取到结果是可以接受的。另外，如果程序转换期被其他jobs饱和填充，在帧的其他地方有一个未被充分利用的时期，在那里调度job会更有效率。

你也可以使用Profiler来查看Unity在哪里等待job完成。主线程上的标记WaitForJobGroupID表明了这一点。这个标记可能意味着在某个地方引入了一个数据依赖，应该解决这个问题。寻找JobHandle.Complete来追踪在哪里有数据依赖，迫使主线程等待。

避免使用长期运行的job
与线程不同，job不会礼让（yield）执行。一旦一个job开始，该job工人线程会逐一执行job。因此，最好的做法是将长期运行的job业分解成相互依赖的小job，而不是提交相对于系统中其他job来说需要很长时间才能完成的job。

job system通常会运行多条job依赖链，因此如果你将长期运行的任务分解成多块，就有机会让多个job链执行。如果相反，job system中充满了长期运行的job，它们可能会完全消耗所有的工人线程，并阻止独立job的执行。这可能会推延主线程等待的重要job的完成时间，导致主线程停滞。

特别是，长时间运行的IJobParallelFor的job对job system产生了负面影响，因为这些job类型有意尝试在尽可能多的工人线程上运行，以满足job批处理的规模。如果你不能分解长的并行job，可以考虑在调度job时增加job的批处理大小，以限制运行长期job的工人线程数量。
```csharp
MyParallelJob jobData = new MyParallelJob();
jobData.Data = someData;  
jobData.Result = someArray;  
// Use half the available worker threads, clamped to a minimum of 1 worker thread
const int numBatches = Math.Max(1, JobsUtility.JobWorkerCount / 2); 
const int totalItems = someArray.Length;
const int batchSize = totalItems / numBatches;
// Schedule the job with one Execute per index in the results array and batchSize items per processing batch
JobHandle handle = jobData.Schedule(result.Length, totalItems, batchSize);
```
