import { useState, useEffect, useMemo, useCallback } from "react";

const BUFFER_ROWS = 2; // extra rows to render above/below viewport

const useVirtualScroll = ({ totalRows, rowHeight, containerRef }) => {
	const [scrollTop, setScrollTop] = useState(0);
	const [containerHeight, setContainerHeight] = useState(0);

	// Measure container height once (and on resize)
	useEffect(() => {
		if (!containerRef.current) return;

		const observer = new ResizeObserver(([entry]) => {
			setContainerHeight(entry.contentRect.height);
		});

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [containerRef]);

	// Track scroll position
	const onScroll = useCallback((e) => {
		setScrollTop(e.currentTarget.scrollTop);
	}, []);

	const visibleRange = useMemo(() => {
		const firstVisible = Math.floor(scrollTop / rowHeight);
		const visibleCount = Math.ceil(containerHeight / rowHeight);

		return {
			start: Math.max(0, firstVisible - BUFFER_ROWS),
			end: Math.min(totalRows - 1, firstVisible + visibleCount + BUFFER_ROWS),
		};
	}, [scrollTop, containerHeight, rowHeight, totalRows]);

	const totalHeight = totalRows * rowHeight; // actual scrollable height

	return { visibleRange, totalHeight, onScroll };
};

export default useVirtualScroll;
