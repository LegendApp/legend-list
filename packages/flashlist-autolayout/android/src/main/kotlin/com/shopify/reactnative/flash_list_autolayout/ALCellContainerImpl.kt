package org.legend_list.flash_list_autolayout

import android.content.Context
import com.facebook.react.views.view.ReactViewGroup

class ALCellContainerImpl(context: Context) : ReactViewGroup(context),
    ALCellContainer {
    private var index = -1
    override fun setIndex(value: Int) {
        index = value
    }

    override fun getIndex(): Int {
        return index
    }

}
