package org.legend_list.flash_list_autolayout.models

import org.legend_list.flash_list_autolayout.ALCellContainer

class Rect (h: Int? = 0, w: Int? = 0):
    ALCellContainer {
    private var left = 0
    private var right = 0
    private var top = 0
    private var bottom = 0
    private var height = 0
    private var width = 0
    private var index = 0

    override fun setIndex(value: Int) {
        index = value
    }

    override fun getIndex(): Int {
        return index
    }

    override fun setLeft(value: Int) {
        left = value
    }

    override fun getLeft(): Int {
        return left
    }

    override fun setTop(value: Int) {
        top = value
    }

    override fun getTop(): Int {
        return top
    }

    override fun setRight(value: Int) {
        right = value
    }

    override fun getRight(): Int {
        return right
    }

    override fun setBottom(value: Int) {
        bottom = value
    }

    override fun getBottom(): Int {
        return bottom
    }

    override fun getHeight(): Int {
        return height
    }

    override fun getWidth(): Int {
        return width
    }
}
